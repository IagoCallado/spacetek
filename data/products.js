/* Dados do site SpaceTek.
   Edite aqui para adicionar/remover pecas (usado como fallback quando o
   banco de dados Firebase esta vazio ou indisponivel).
   Campos:
     id        (unico)
     nome
     categoria
     imagem
     novo      (opcional, booleano)
     secao     (opcional: "catalogo" | "lancamentos")
   Campos opcionais editaveis pelo painel admin:
     preco     (numero em R$; vazio = "Sob consulta")
     descricao (texto)
     filamento ("PLA" | "PETG" | "")
     peso      (numero em gramas)
     dimensoes (texto, ex.: "10x5x8 cm") */

window.WHATSAPP_NUMBER = "5518996903550";

window.CATALOGO = [
  { id: "c01", nome: "Vaso Geométrico", categoria: "Decoração", imagem: "assets/images/p1.svg" },
  { id: "c02", nome: "Suporte de Celular", categoria: "Utilidades", imagem: "assets/images/p2.svg", novo: true },
  { id: "c03", nome: "Luminária Lua", categoria: "Iluminação", imagem: "assets/images/p3.svg" },
  { id: "c04", nome: "Organizador de Mesa", categoria: "Escritório", imagem: "assets/images/p4.svg" },
  { id: "c05", nome: "Chaveiro Personalizado", categoria: "Personalizados", imagem: "assets/images/p5.svg" },
  { id: "c06", nome: "Porta-canetas Hexagonal", categoria: "Escritório", imagem: "assets/images/p6.svg" },
  { id: "c07", nome: "Action Figure", categoria: "Colecionáveis", imagem: "assets/images/p7.svg", novo: true },
  { id: "c08", nome: "Suporte de Fone", categoria: "Escritório", imagem: "assets/images/p8.svg" },
  { id: "c09", nome: "Vaso Espiral", categoria: "Decoração", imagem: "assets/images/p9.svg" },
  { id: "c10", nome: "Miniatura Dragão", categoria: "Colecionáveis", imagem: "assets/images/p10.svg" },
  { id: "c11", nome: "Troféu Personalizado", categoria: "Personalizados", imagem: "assets/images/p11.svg" },
  { id: "c12", nome: "Suporte de Tablet", categoria: "Utilidades", imagem: "assets/images/p12.svg" },
  { id: "c13", nome: "Vaso Low Poly", categoria: "Decoração", imagem: "assets/images/p13.svg" },
  { id: "c14", nome: "Engrenagem Decorativa", categoria: "Decoração", imagem: "assets/images/p14.svg" }
];

window.LANCAMENTOS = [
  { id: "l01", nome: "Luminária Caveira", categoria: "Iluminação", imagem: "assets/images/p15.svg", novo: true },
  { id: "l02", nome: "Mini Busto", categoria: "Colecionáveis", imagem: "assets/images/p16.svg", novo: true },
  { id: "l03", nome: "Porta-chaves de Parede", categoria: "Utilidades", imagem: "assets/images/p17.svg", novo: true },
  { id: "l04", nome: "Vaso Fractal", categoria: "Decoração", imagem: "assets/images/p18.svg", novo: true },
  { id: "l05", nome: "Suporte de Controle", categoria: "Utilidades", imagem: "assets/images/p9.svg", novo: true },
  { id: "l06", nome: "Abajur Estelar", categoria: "Iluminação", imagem: "assets/images/p3.svg", novo: true },
  { id: "l07", nome: "Placa Decorativa", categoria: "Decoração", imagem: "assets/images/p7.svg", novo: true },
  { id: "l08", nome: "Organizador Modular", categoria: "Escritório", imagem: "assets/images/p2.svg", novo: true }
];
