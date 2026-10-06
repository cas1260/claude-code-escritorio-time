"""Gera os módulos de dados do mod a partir das imagens do escritório.

Lê Escritorio-vazio.png e sprite1..4.png e escreve:
  hooks/dados-fundo.ts    a arte do escritório vazio, como imagem AVIF em data URI
  hooks/dados-sprites.ts  quadros dos 17 personagens em pixel art vetorial

O painel do app desktop filtra o SVG: a tag <image> é removida, mas imagem em
CSS (background do <svg>) é aceita. Por isso o fundo sai como data URI para o
CSS e os personagens saem como paths.

Uso:
  python gerar_dados.py --docs <pasta com os PNG> [--saida <pasta hooks>] [--previa <pasta>]

Depende de Pillow (com AVIF), numpy e scipy.
"""
import argparse
import base64
import io
import os

import numpy as np
from PIL import Image
from scipy import ndimage

# Um elemento Svg aceita 131.072 caracteres. O fundo é um desenho só dele
# (camada que nunca é redesenhada), então a imagem fica com quase tudo.
LIMITE_FUNDO = 130000

# Largura, em pixels, da imagem de fundo embutida (a da arte original).
LARGURA_FUNDO = 1448

CORES_SPRITE = 10

# Pixels de origem por célula: as folhas 1 a 3 têm corpos de ~148 px de altura
# e a folha 4 de ~246 px; os passos abaixo deixam todos com ~30 células.
PASSO = {"sprite1.png": 5.0, "sprite2.png": 5.0, "sprite3.png": 5.0, "sprite4.png": 8.31}

# (arquivo, linha da folha, id do agente)
AGENTES = [
    ("sprite1.png", 0, "frank"),
    ("sprite1.png", 1, "prime"),
    ("sprite1.png", 2, "cas"),
    ("sprite1.png", 3, "almeida"),
    ("sprite1.png", 4, "tiobill"),
    ("sprite2.png", 0, "mio"),
    ("sprite2.png", 1, "aizen"),
    ("sprite2.png", 2, "goku"),
    ("sprite2.png", 3, "gojo"),
    ("sprite2.png", 4, "saitama"),
    ("sprite3.png", 0, "naruto"),
    ("sprite3.png", 1, "madara"),
    ("sprite3.png", 2, "meruem"),
    ("sprite3.png", 3, "luffy"),
    ("sprite3.png", 4, "ichigo"),
    ("sprite4.png", 0, "tiquinho"),
    ("sprite4.png", 1, "soares"),
]

# Coluna da folha usada em cada pose (0-2 frente, 3-5 lado virado para a
# esquerda, 9-11 costas).
POSES = {"frente": 0, "lado1": 3, "lado2": 4, "costas": 9}

# Sentados de costas para quem olha (monitor acima da cadeira).
SENTADOS_DE_COSTAS = {"tiquinho", "soares"}

# Fração da altura (a partir do topo) que aparece acima do encosto da cadeira.
FRACAO_SENTADO = 0.8

LUMINANCIA = np.array([0.299, 0.587, 0.114])


def corpos_da_folha(imagem, linhas):
    """Devolve, por linha da folha, os 12 corpos (fatia, máscara) da esquerda para a direita."""
    alfa = np.asarray(imagem)[..., 3] > 60
    rotulos, _ = ndimage.label(alfa, structure=np.ones((3, 3)))
    fatias = ndimage.find_objects(rotulos)
    corpos = []
    for indice, fatia in enumerate(fatias):
        mascara = rotulos[fatia] == indice + 1
        if mascara.sum() < 1500:
            continue
        cy = (fatia[0].start + fatia[0].stop) / 2
        cx = (fatia[1].start + fatia[1].stop) / 2
        corpos.append((cy, cx, fatia, mascara))
    if len(corpos) != linhas * 12:
        raise SystemExit(f"esperados {linhas * 12} corpos, achados {len(corpos)}")
    corpos.sort(key=lambda c: c[0])
    grade = []
    for linha in range(linhas):
        da_linha = sorted(corpos[linha * 12:(linha + 1) * 12], key=lambda c: c[1])
        grade.append([(c[2], c[3]) for c in da_linha])
    return grade


def paleta_de(pixels, cores):
    """Paleta adaptativa (corte mediano refinado por k-means) de uma lista de pixels RGB."""
    tira = Image.fromarray(pixels.reshape(1, -1, 3).astype(np.uint8), "RGB")
    quantizada = tira.quantize(colors=cores, method=Image.Quantize.MEDIANCUT, kmeans=3)
    paleta = np.array(quantizada.getpalette()[:cores * 3], dtype=np.int32).reshape(-1, 3)
    usadas = sorted(set(np.asarray(quantizada).ravel().tolist()))
    return paleta[usadas]


def indice_mais_proximo(pixels, paleta):
    dist = ((pixels[:, None, :].astype(np.int32) - paleta[None, :, :]) ** 2).sum(axis=2)
    return dist.argmin(axis=1)


def celulas_do_corpo(rgba, mascara, passo, paleta):
    """Reduz um corpo à grade de células: -1 transparente, senão índice da paleta."""
    alt, larg = mascara.shape
    colunas = int(np.ceil(larg / passo))
    linhas = int(np.ceil(alt / passo))
    # centraliza na horizontal e alinha os pés na base
    desloc_x = (colunas * passo - larg) / 2
    desloc_y = linhas * passo - alt
    peso = np.where(paleta @ LUMINANCIA < 70, 1.5, 1.0)  # preserva o contorno escuro
    grade = -np.ones((linhas, colunas), dtype=np.int32)
    for j in range(linhas):
        y0 = int(round(j * passo - desloc_y))
        y1 = int(round((j + 1) * passo - desloc_y))
        y0c, y1c = max(y0, 0), min(y1, alt)
        if y1c <= y0c:
            continue
        for i in range(colunas):
            x0 = int(round(i * passo - desloc_x))
            x1 = int(round((i + 1) * passo - desloc_x))
            x0c, x1c = max(x0, 0), min(x1, larg)
            if x1c <= x0c:
                continue
            bloco_m = mascara[y0c:y1c, x0c:x1c]
            area = (y1 - y0) * (x1 - x0)
            if bloco_m.sum() < 0.5 * area:
                continue
            pixels = rgba[y0c:y1c, x0c:x1c, :3][bloco_m]
            votos = np.bincount(indice_mais_proximo(pixels, paleta), minlength=len(paleta)) * peso
            grade[j, i] = int(votos.argmax())
    # remove linhas/colunas vazias nas bordas
    ocupadas_l = np.where((grade >= 0).any(axis=1))[0]
    ocupadas_c = np.where((grade >= 0).any(axis=0))[0]
    return grade[ocupadas_l[0]:ocupadas_l[-1] + 1, ocupadas_c[0]:ocupadas_c[-1] + 1]


def corridas(alvo, livre):
    """Intervalos [x0, x1) de uma linha que cobrem todo `alvo`.

    Uma corrida pode passar por células de `livre` (as que uma camada pintada
    depois vai cobrir), o que junta trechos vizinhos e encurta o traçado.
    """
    res = []
    d = np.diff(np.concatenate(([0], (alvo | livre).astype(np.int8), [0])))
    for x0, x1 in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
        dentro = np.where(alvo[x0:x1])[0]
        if len(dentro):
            res.append((int(x0 + dentro[0]), int(x0 + dentro[-1] + 1)))
    return res


def tracado(alvo, livre):
    """Atributo `d` com as corridas horizontais de `alvo`, cada salto na forma mais curta."""
    trechos = []
    px = py = None
    for y in range(alvo.shape[0]):
        for x0, x1 in corridas(alvo[y], livre[y]):
            absoluto = f"M{x0} {y}"
            if px is None:
                salto = absoluto
            else:
                relativo = f"m{x0 - px} {y - py}"
                salto = relativo if len(relativo) < len(absoluto) else absoluto
            trechos.append(f"{salto}h{x1 - x0}")
            px, py = x1, y
    return "".join(trechos)


def camadas(grade, paleta, ordem):
    """Um path por cor, na ordem dada; cada um pode passar por baixo dos seguintes."""
    partes = []
    for k, cor in enumerate(ordem):
        d = tracado(grade == cor, np.isin(grade, ordem[k + 1:]))
        if d:
            partes.append(f'<path stroke="{hexa(paleta[cor])}" d="{d}"/>')
    return "".join(partes)


def caminhos_do_sprite(grade, paleta):
    """Pixel art -> marcação SVG: silhueta escura por baixo e as cores em camadas."""
    escuro = int((paleta @ LUMINANCIA).argmin())
    opaco = grade >= 0
    silhueta = tracado(opaco, np.zeros_like(opaco))
    uso = np.bincount(grade[opaco], minlength=len(paleta))
    ordem = [int(cor) for cor in np.argsort(-uso) if cor != escuro and uso[cor] > 0]
    return f'<path stroke="{hexa(paleta[escuro])}" stroke-width="1.3" d="{silhueta}"/>' + camadas(grade, paleta, ordem)


def hexa(cor):
    return "#%02x%02x%02x" % (int(cor[0]), int(cor[1]), int(cor[2]))


def gerar_sprites(docs):
    folhas = {}
    sprites = {}
    grades = {}
    for arquivo, linha, agente in AGENTES:
        if arquivo not in folhas:
            imagem = Image.open(os.path.join(docs, arquivo)).convert("RGBA")
            folhas[arquivo] = (np.asarray(imagem), corpos_da_folha(imagem, 2 if arquivo == "sprite4.png" else 5))
        rgba, grade_corpos = folhas[arquivo]
        recortes = {}
        amostras = []
        for pose, coluna in POSES.items():
            fatia, mascara = grade_corpos[linha][coluna]
            recorte = rgba[fatia]
            recortes[pose] = (recorte, mascara)
            amostras.append(recorte[..., :3][mascara & (recorte[..., 3] > 200)])
        paleta = paleta_de(np.concatenate(amostras), CORES_SPRITE)
        quadros = {}
        for pose, (recorte, mascara) in recortes.items():
            quadros[pose] = celulas_do_corpo(recorte, mascara, PASSO[arquivo], paleta)
        base = quadros["costas" if agente in SENTADOS_DE_COSTAS else "frente"]
        quadros["sentado"] = base[:int(round(base.shape[0] * FRACAO_SENTADO))]
        grades[agente] = (quadros, paleta)
        sprites[agente] = {
            pose: {"l": int(g.shape[1]), "a": int(g.shape[0]), "d": caminhos_do_sprite(g, paleta)}
            for pose, g in quadros.items()
        }
    return sprites, grades


def avif(imagem, qualidade):
    saida = io.BytesIO()
    imagem.save(saida, "AVIF", quality=qualidade, speed=2)
    return saida.getvalue()


def gerar_fundo(vazio):
    """A arte do escritório vazio em AVIF, na maior qualidade que cabe no limite."""
    altura = round(vazio.height * LARGURA_FUNDO / vazio.width)
    reduzida = vazio.resize((LARGURA_FUNDO, altura), Image.LANCZOS)
    prefixo = "data:image/avif;base64,"
    menor, maior, escolhido = 5, 90, None
    while menor <= maior:
        qualidade = (menor + maior) // 2
        dados = avif(reduzida, qualidade)
        if len(prefixo) + 4 * ((len(dados) + 2) // 3) <= LIMITE_FUNDO:
            escolhido = (qualidade, dados)
            menor = qualidade + 1
        else:
            maior = qualidade - 1
    if escolhido is None:
        raise SystemExit("o fundo não coube no limite de caracteres")
    qualidade, dados = escolhido
    # cor mais comum da arte: aparece em volta do desenho e se a imagem faltar
    paleta = paleta_de(np.asarray(reduzida.resize((181, 136), Image.BOX)).reshape(-1, 3), 8)
    pixels = np.asarray(reduzida.resize((181, 136), Image.BOX)).reshape(-1, 3)
    cor = paleta[np.bincount(indice_mais_proximo(pixels, paleta), minlength=len(paleta)).argmax()]
    return {"uri": prefixo + base64.b64encode(dados).decode("ascii"), "qualidade": qualidade, "cor": hexa(cor)}, dados


def texto_ts(valor):
    return "'" + valor.replace("\\", "\\\\").replace("'", "\\'") + "'"


def escrever_fundo(caminho, vazio, fundo):
    linhas = [
        "// GERADO por ferramentas/gerar_dados.py a partir de Escritorio-vazio.png. Não editar à mão.",
        "",
        "// Sistema de coordenadas do desenho: o tamanho da arte original.",
        f"export const FUNDO_LARGURA = {vazio.width}",
        f"export const FUNDO_ALTURA = {vazio.height}",
        "",
        "// Cor mais comum da arte: fica em volta do desenho e no lugar da imagem se ela faltar.",
        f"export const FUNDO_COR = {texto_ts(fundo['cor'])}",
        "",
        f"export const FUNDO_IMAGEM = {texto_ts(fundo['uri'])}",
        "",
    ]
    with open(caminho, "w", encoding="utf-8", newline="\n") as arquivo:
        arquivo.write("\n".join(linhas))


def escrever_sprites(caminho, sprites):
    linhas = [
        "// GERADO por ferramentas/gerar_dados.py a partir de sprite1.png a sprite4.png. Não editar à mão.",
        "",
        "export type Quadro = { l: number; a: number; d: string }",
        "",
        "export type Poses = { frente: Quadro; lado1: Quadro; lado2: Quadro; costas: Quadro; sentado: Quadro }",
        "",
        "export const SPRITES = {",
    ]
    for agente, poses in sprites.items():
        linhas.append(f"  {agente}: {{")
        for pose, quadro in poses.items():
            linhas.append(f"    {pose}: {{ l: {quadro['l']}, a: {quadro['a']}, d: {texto_ts(quadro['d'])} }},")
        linhas.append("  },")
    linhas.append("} satisfies Record<string, Poses>")
    linhas.append("")
    with open(caminho, "w", encoding="utf-8", newline="\n") as arquivo:
        arquivo.write("\n".join(linhas))


def salvar_previas(pasta, grades, imagem_do_fundo):
    os.makedirs(pasta, exist_ok=True)
    zoom = 4
    folha = Image.new("RGB", (5 * 34 * zoom, len(grades) * 42 * zoom), (58, 78, 110))
    for linha, (agente, (quadros, paleta)) in enumerate(grades.items()):
        for coluna, pose in enumerate(["frente", "lado1", "lado2", "costas", "sentado"]):
            grade = quadros[pose]
            rgb = np.zeros(grade.shape + (4,), dtype=np.uint8)
            rgb[grade >= 0, :3] = paleta[grade[grade >= 0]]
            rgb[grade >= 0, 3] = 255
            quadro = Image.fromarray(rgb, "RGBA").resize((grade.shape[1] * zoom, grade.shape[0] * zoom), Image.NEAREST)
            folha.paste(quadro, (coluna * 34 * zoom + 8, linha * 42 * zoom + 8), quadro)
    folha.save(os.path.join(pasta, "previa_sprites.png"))
    Image.open(io.BytesIO(imagem_do_fundo)).convert("RGB").save(os.path.join(pasta, "previa_fundo.png"))


def principal():
    aqui = os.path.dirname(os.path.abspath(__file__))
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument("--docs", required=True, help="pasta com Escritorio-vazio.png e sprite1..4.png")
    argumentos.add_argument("--saida", default=os.path.join(aqui, "..", "hooks"), help="pasta hooks do mod")
    argumentos.add_argument("--previa", help="pasta onde salvar imagens de conferência")
    opcoes = argumentos.parse_args()

    vazio = Image.open(os.path.join(opcoes.docs, "Escritorio-vazio.png")).convert("RGB")
    fundo, imagem_do_fundo = gerar_fundo(vazio)
    sprites, grades = gerar_sprites(opcoes.docs)

    os.makedirs(opcoes.saida, exist_ok=True)
    escrever_fundo(os.path.join(opcoes.saida, "dados-fundo.ts"), vazio, fundo)
    escrever_sprites(os.path.join(opcoes.saida, "dados-sprites.ts"), sprites)
    if opcoes.previa:
        salvar_previas(opcoes.previa, grades, imagem_do_fundo)

    print(f"fundo: {len(fundo['uri'])} caracteres (AVIF {LARGURA_FUNDO} px, qualidade {fundo['qualidade']}, cor {fundo['cor']})")
    sentados = 0
    maior_andando = 0
    for agente, poses in sprites.items():
        print(f"{agente:9s}", " ".join(f"{pose}={q['l']}x{q['a']}/{len(q['d'])}" for pose, q in poses.items()))
        sentados += len(poses["sentado"]["d"])
        maior_andando = max(maior_andando, sum(len(poses[p]["d"]) for p in POSES))
    print(f"sprites: 17 sentados = {sentados} caracteres; maior caminhante = {maior_andando}")


if __name__ == "__main__":
    principal()
