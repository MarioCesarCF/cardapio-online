// Cardápios modelo ("cadastro automático"): estruturas prontas para uma
// lanchonete que ainda não cadastrou nada. O dono usa como ponto de partida e
// edita tudo depois (preços, nomes, imagens, extras).
//
// Decisões de modelagem (o schema de opções é por grupo, não por produto):
// - As listas "Adicionais"/"Removíveis" viram **um grupo compartilhado** por
//   tema (a união das opções de todos os produtos) — é o mesmo padrão usado no
//   seed. Criar um grupo por produto explodiria a lista de grupos do painel.
// - Onde o cliente só pode escolher 1 (molho, borda, tamanho) o grupo é
//   "unica" com maxSelecoes 1; onde pode escolher vários, "multipla".
// - "Remover" nunca divide grupo com acréscimo: as regras do back rejeitam
//   "remover" combinado com adições no mesmo grupo.
// - `imagem` do produto é a **palavra-chave** da galeria de imagens (coluna
//   `keywords` de `galeria_imagens`) — o `gerarCardapioModelo` troca pela URL
//   de uma foto da galeria. Produto sem `imagem` fica sem foto (o lojista
//   escolhe na galeria depois). As chaves aceitas estão em
//   `CHAVES_IMAGEM_GALERIA` e são garantidas pelo `npm run seed:galeria`.
export const TIPOS_MODELO = ['lanches', 'pizzaria', 'acai'] as const;
export type TipoModelo = (typeof TIPOS_MODELO)[number];

export interface OpcaoModelo {
  nome: string;
  precoAdicional: number;
  remove?: boolean;
}

export interface GrupoModelo {
  nome: string;
  tipo: 'unica' | 'multipla';
  obrigatorio: boolean;
  minSelecoes: number;
  maxSelecoes: number | null;
  opcoes: OpcaoModelo[];
}

export interface ProdutoModelo {
  nome: string;
  preco: number;
  descricao?: string;
  destaque?: boolean;
  grupos?: string[];
  /** Palavra-chave da galeria (ver `CHAVES_IMAGEM_GALERIA`). */
  imagem?: string;
}

/**
 * Palavras-chave que o `seed:galeria` garante ter. Os itens mais específicos
 * (`lata-refrigerante`, `garrafa-cerveja`, …) existem para separar o que é
 * latinha de refrigerante e long neck de cerveja; os genéricos (`lata`,
 * `garrafa`, `agua`, …) servem à busca do painel do lojista.
 */
export const CHAVES_IMAGEM_GALERIA = [
  'hamburguer',
  'batata',
  'batata-doce',
  'hot dog',
  'calabresa',
  'pizza',
  'pizza-doce',
  'suco',
  'laranja',
  'maracuja',
  'sorvete',
  'pudim',
  'mousse',
  'acai',
  'creme',
  'banana',
  'morango',
  'manga',
  'kiwi',
  'uva',
  'lata',
  'lata-refrigerante',
  'garrafa',
  'garrafa-refrigerante',
  'agua',
  'lata-cerveja',
  'garrafa-cerveja',
  'combo',
] as const;

export interface CategoriaModelo {
  nome: string;
  produtos: ProdutoModelo[];
}

export interface CardapioModelo {
  tipo: TipoModelo;
  rotulo: string;
  categorias: CategoriaModelo[];
  grupos: GrupoModelo[];
}

// ---------------------------------------------------------------- Lanchonete
const MODELO_LANCHES: CardapioModelo = {
  tipo: 'lanches',
  rotulo: 'Lanchonete',
  grupos: [
    {
      nome: 'Adicionais',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Bacon', precoAdicional: 3 },
        { nome: 'Bacon extra', precoAdicional: 5 },
        { nome: 'Ovo', precoAdicional: 2.5 },
        { nome: 'Presunto', precoAdicional: 2.5 },
        { nome: 'Queijo', precoAdicional: 3 },
        { nome: 'Queijo extra', precoAdicional: 5 },
        { nome: 'Calabresa', precoAdicional: 3 },
        { nome: 'Milho', precoAdicional: 2 },
        { nome: 'Ervilha', precoAdicional: 2 },
        { nome: 'Frango extra', precoAdicional: 6 },
        { nome: 'Catupiry', precoAdicional: 4 },
        { nome: 'Cebola caramelizada', precoAdicional: 3 },
        { nome: 'Batata palha', precoAdicional: 2 },
        { nome: 'Molho especial', precoAdicional: 2 },
      ],
    },
    {
      nome: 'Molhos',
      tipo: 'unica',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: 1,
      opcoes: [
        { nome: 'Cheddar', precoAdicional: 4 },
        { nome: 'Maionese da casa', precoAdicional: 2 },
        { nome: 'Maionese temperada', precoAdicional: 2 },
        { nome: 'Ketchup', precoAdicional: 1.5 },
        { nome: 'Mostarda', precoAdicional: 1.5 },
        { nome: 'Molho de alho', precoAdicional: 2 },
        { nome: 'Molho barbecue', precoAdicional: 2 },
      ],
    },
    {
      nome: 'Removíveis',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Sem alface', precoAdicional: 0, remove: true },
        { nome: 'Sem tomate', precoAdicional: 0, remove: true },
        { nome: 'Sem cebola', precoAdicional: 0, remove: true },
        { nome: 'Sem milho', precoAdicional: 0, remove: true },
        { nome: 'Sem ervilha', precoAdicional: 0, remove: true },
        { nome: 'Sem queijo', precoAdicional: 0, remove: true },
        { nome: 'Sem bacon', precoAdicional: 0, remove: true },
      ],
    },
  ],
  categorias: [
    {
      nome: 'Hambúrgueres',
      produtos: [
        {
          nome: 'Hambúrguer Artesanal',
          preco: 32.9,
          descricao: 'Pão brioche, carne 180g, queijo e cebola caramelizada.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hamburguer',
        },
      ],
    },
    {
      nome: 'X-Saladas',
      produtos: [
        {
          nome: 'X-Salada',
          preco: 22.9,
          descricao: 'Hambúrguer, queijo, presunto e salada.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hamburguer',
        },
        {
          nome: 'X-Bacon',
          preco: 25.9,
          descricao: 'Hambúrguer, queijo e bacon.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hamburguer',
        },
        {
          nome: 'X-Tudo',
          preco: 28.9,
          descricao: 'Hambúrguer com queijo, presunto, bacon e salada.',
          destaque: true,
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hamburguer',
        },
        {
          nome: 'X-Frango',
          preco: 26.9,
          descricao: 'Hambúrguer, queijo e frango grelhado.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hamburguer',
        },
      ],
    },
    {
      nome: 'Cachorros-quentes',
      produtos: [
        {
          nome: 'Cachorro-Quente',
          preco: 15.9,
          descricao: 'Salsicha, molho, milho, ervilha e batata palha.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hot dog',
        },
        {
          nome: 'Cachorro-Quente Especial',
          preco: 19.9,
          descricao: 'Duas salsichas, queijo, calabresa e batata palha.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'hot dog',
        },
      ],
    },
    {
      nome: 'Porções',
      produtos: [
        {
          nome: 'Batata Frita P',
          preco: 12,
          descricao: 'Porção pequena de batata frita crocante.',
          grupos: ['Adicionais', 'Removíveis'],
          imagem: 'batata',
        },
        {
          nome: 'Batata Frita G',
          preco: 18,
          descricao: 'Porção grande de batata frita crocante.',
          grupos: ['Adicionais', 'Removíveis'],
          imagem: 'batata',
        },
        {
          nome: 'Calabresa Acebolada',
          preco: 26,
          descricao: 'Calabresa fatiada na chapa com cebola.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'calabresa',
        },
      ],
    },
    {
      nome: 'Combos',
      produtos: [
        {
          nome: 'Combo X-Salada',
          preco: 34.9,
          descricao: 'X-Salada, batata frita pequena e refrigerante lata.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'combo',
        },
        {
          nome: 'Combo X-Bacon',
          preco: 37.9,
          descricao: 'X-Bacon, batata frita pequena e refrigerante lata.',
          grupos: ['Adicionais', 'Molhos', 'Removíveis'],
          imagem: 'combo',
        },
      ],
    },
    {
      nome: 'Bebidas',
      produtos: [
        { nome: 'Coca-Cola lata', preco: 6.5, imagem: 'lata-refrigerante' },
        { nome: 'Guaraná lata', preco: 5.5, imagem: 'lata-refrigerante' },
        { nome: 'Coca-Cola 600 ml', preco: 8, imagem: 'garrafa-refrigerante' },
        { nome: 'Guaraná 1,5 L', preco: 10, imagem: 'garrafa-refrigerante' },
        { nome: 'Água mineral', preco: 3, imagem: 'agua' },
        { nome: 'Suco de laranja', preco: 9, imagem: 'laranja' },
        { nome: 'Suco de maracujá', preco: 9, imagem: 'maracuja' },
      ],
    },
    {
      nome: 'Sobremesas',
      produtos: [
        { nome: 'Pudim', preco: 9, imagem: 'pudim' },
        { nome: 'Mousse de maracujá', preco: 9.5, imagem: 'mousse' },
        { nome: 'Sorvete (2 bolas)', preco: 8, imagem: 'sorvete' },
      ],
    },
  ],
};

// ------------------------------------------------------------------ Pizzaria
const MODELO_PIZZARIA: CardapioModelo = {
  tipo: 'pizzaria',
  rotulo: 'Pizzaria',
  grupos: [
    {
      nome: 'Tamanho',
      tipo: 'unica',
      obrigatorio: true,
      minSelecoes: 1,
      maxSelecoes: 1,
      opcoes: [
        { nome: 'Média (6 fatias)', precoAdicional: 0 },
        { nome: 'Grande (8 fatias)', precoAdicional: 12 },
        { nome: 'Família (12 fatias)', precoAdicional: 26 },
      ],
    },
    {
      nome: 'Adicionais',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Queijo extra', precoAdicional: 5 },
        { nome: 'Bacon', precoAdicional: 5 },
        { nome: 'Calabresa', precoAdicional: 4 },
        { nome: 'Catupiry', precoAdicional: 5 },
        { nome: 'Milho', precoAdicional: 3 },
        { nome: 'Cebola', precoAdicional: 2 },
        { nome: 'Tomate', precoAdicional: 2 },
      ],
    },
    {
      nome: 'Bordas',
      tipo: 'unica',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: 1,
      opcoes: [
        { nome: 'Borda recheada com catupiry', precoAdicional: 12 },
        { nome: 'Borda recheada com cheddar', precoAdicional: 12 },
      ],
    },
    {
      nome: 'Removíveis',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Sem cebola', precoAdicional: 0, remove: true },
        { nome: 'Sem tomate', precoAdicional: 0, remove: true },
        { nome: 'Sem milho', precoAdicional: 0, remove: true },
        { nome: 'Sem bacon', precoAdicional: 0, remove: true },
        { nome: 'Sem catupiry', precoAdicional: 0, remove: true },
        { nome: 'Sem orégano', precoAdicional: 0, remove: true },
        { nome: 'Sem ovo', precoAdicional: 0, remove: true },
        { nome: 'Sem pimentão', precoAdicional: 0, remove: true },
      ],
    },
  ],
  categorias: [
    {
      nome: 'Pizzas Salgadas',
      produtos: [
        {
          nome: 'Mussarela',
          preco: 45,
          descricao: 'Molho, mussarela e orégano.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Calabresa',
          preco: 48,
          descricao: 'Molho, calabresa e cebola.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Presunto e Queijo',
          preco: 50,
          descricao: 'Molho, presunto e mussarela.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Frango com Catupiry',
          preco: 52,
          descricao: 'Frango desfiado, catupiry e milho.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Portuguesa',
          preco: 55,
          descricao: 'Presunto, ovo, cebola, pimentão e ervilha.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Bacon',
          preco: 54,
          descricao: 'Mussarela, bacon e cebola.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Frango com Milho',
          preco: 53,
          descricao: 'Frango desfiado, milho e catupiry.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Quatro Queijos',
          preco: 56,
          descricao: 'Mussarela, catupiry, gorgonzola e parmesão.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Moda da Casa',
          preco: 58,
          descricao: 'Presunto, frango, calabresa, bacon e catupiry.',
          destaque: true,
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
        {
          nome: 'Carne Seca com Catupiry',
          preco: 62,
          descricao: 'Carne seca desfiada, catupiry e cebola.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas', 'Removíveis'],
          imagem: 'pizza',
        },
      ],
    },
    {
      nome: 'Pizzas Doces',
      produtos: [
        {
          nome: 'Chocolate',
          preco: 46,
          descricao: 'Chocolate meio amargo e chocolate branco.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'pizza-doce',
        },
        {
          nome: 'Chocolate com Morango',
          preco: 50,
          descricao: 'Chocolate, morango e leite condensado.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'pizza-doce',
        },
        {
          nome: 'Banana com Canela',
          preco: 45,
          descricao: 'Banana, açúcar e canela.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'pizza-doce',
        },
        {
          nome: 'Prestígio',
          preco: 50,
          descricao: 'Chocolate, coco ralado e prestígio.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'pizza-doce',
        },
        {
          nome: 'Romeu e Julieta',
          preco: 52,
          descricao: 'Mussarela, goiabada e doce de leite.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'pizza-doce',
        },
      ],
    },
    {
      nome: 'Bebidas',
      produtos: [
        { nome: 'Coca-Cola 1,5 L', preco: 10, imagem: 'garrafa-refrigerante' },
        { nome: 'Guaraná 1,5 L', preco: 9, imagem: 'garrafa-refrigerante' },
        { nome: 'Coca-Cola 2 L', preco: 13, imagem: 'garrafa-refrigerante' },
        { nome: 'Guaraná 2 L', preco: 12, imagem: 'garrafa-refrigerante' },
        { nome: 'Água', preco: 3, imagem: 'agua' },
        { nome: 'Suco', preco: 9, imagem: 'suco' },
      ],
    },
    {
      nome: 'Combos',
      produtos: [
        {
          nome: 'Combo Pizza + Refrigerante 1,5 L',
          preco: 54.9,
          descricao: 'Uma pizza sabor do dia com refrigerante de 1,5 L.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'combo',
        },
        {
          nome: 'Combo Pizza + Refrigerante 2 L',
          preco: 57.9,
          descricao: 'Uma pizza sabor do dia com refrigerante de 2 L.',
          grupos: ['Tamanho', 'Adicionais', 'Bordas'],
          imagem: 'combo',
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------- Açaíteria
const MODELO_ACAI: CardapioModelo = {
  tipo: 'acai',
  rotulo: 'Açaíteria',
  grupos: [
    {
      nome: 'Tamanho',
      tipo: 'unica',
      obrigatorio: true,
      minSelecoes: 1,
      maxSelecoes: 1,
      opcoes: [
        { nome: '300 ml', precoAdicional: 0 },
        { nome: '500 ml', precoAdicional: 5 },
        { nome: '700 ml', precoAdicional: 11 },
      ],
    },
    {
      // O Açaí Especial não tem opção de 300 ml, então usa um grupo próprio.
      nome: 'Tamanho Especial',
      tipo: 'unica',
      obrigatorio: true,
      minSelecoes: 1,
      maxSelecoes: 1,
      opcoes: [
        { nome: '500 ml', precoAdicional: 0 },
        { nome: '700 ml', precoAdicional: 7 },
      ],
    },
    {
      nome: 'Complementos',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Leite Ninho', precoAdicional: 4 },
        { nome: 'Leite condensado', precoAdicional: 3 },
        { nome: 'Paçoca', precoAdicional: 3 },
        { nome: 'Granola', precoAdicional: 3 },
        { nome: 'Granulado', precoAdicional: 2 },
        { nome: 'Coco ralado', precoAdicional: 3 },
        { nome: 'Castanha', precoAdicional: 5 },
        { nome: 'Amendoim', precoAdicional: 2 },
        { nome: 'Bis', precoAdicional: 4 },
        { nome: 'Ovomaltine', precoAdicional: 3 },
        { nome: 'Confete de chocolate', precoAdicional: 2 },
        { nome: 'Calda de chocolate', precoAdicional: 3 },
        { nome: 'Calda de morango', precoAdicional: 3 },
        { nome: 'Calda de caramelo', precoAdicional: 3 },
      ],
    },
    {
      nome: 'Frutas',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Banana', precoAdicional: 2 },
        { nome: 'Morango', precoAdicional: 3 },
        { nome: 'Manga', precoAdicional: 3 },
        { nome: 'Kiwi', precoAdicional: 3 },
        { nome: 'Uva', precoAdicional: 2 },
      ],
    },
    {
      nome: 'Cremes',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Creme de Ninho', precoAdicional: 4 },
        { nome: 'Creme de morango', precoAdicional: 4 },
        { nome: 'Creme de cupuaçu', precoAdicional: 4 },
        { nome: 'Creme de chocolate', precoAdicional: 4 },
      ],
    },
    {
      nome: 'Removíveis',
      tipo: 'multipla',
      obrigatorio: false,
      minSelecoes: 0,
      maxSelecoes: null,
      opcoes: [
        { nome: 'Sem banana', precoAdicional: 0, remove: true },
        { nome: 'Sem morango', precoAdicional: 0, remove: true },
        { nome: 'Sem granola', precoAdicional: 0, remove: true },
        { nome: 'Sem leite condensado', precoAdicional: 0, remove: true },
        { nome: 'Sem leite Ninho', precoAdicional: 0, remove: true },
        { nome: 'Sem paçoca', precoAdicional: 0, remove: true },
        { nome: 'Sem calda de chocolate', precoAdicional: 0, remove: true },
      ],
    },
  ],
  categorias: [
    {
      nome: 'Açaí',
      produtos: [
        {
          nome: 'Açaí Tradicional',
          preco: 16,
          descricao: 'Açaí puro, servido com banana.',
          grupos: ['Tamanho', 'Complementos', 'Frutas', 'Cremes', 'Removíveis'],
          imagem: 'acai',
        },
        {
          nome: 'Açaí com Leite Ninho',
          preco: 19,
          descricao: 'Açaí com leite ninho.',
          grupos: ['Tamanho', 'Complementos', 'Frutas', 'Cremes', 'Removíveis'],
          imagem: 'acai',
        },
        {
          nome: 'Açaí com Morango',
          preco: 18,
          descricao: 'Açaí com morango e leite condensado.',
          grupos: ['Tamanho', 'Complementos', 'Frutas', 'Cremes', 'Removíveis'],
          imagem: 'acai',
        },
        {
          nome: 'Açaí com Banana',
          preco: 17,
          descricao: 'Açaí com banana e granola.',
          grupos: ['Tamanho', 'Complementos', 'Frutas', 'Cremes', 'Removíveis'],
          imagem: 'acai',
        },
        {
          nome: 'Açaí Especial',
          preco: 29,
          descricao:
            'Açaí com frutas, dois complementos e calda (a partir de 500 ml).',
          destaque: true,
          grupos: [
            'Tamanho Especial',
            'Complementos',
            'Frutas',
            'Cremes',
            'Removíveis',
          ],
          imagem: 'acai',
        },
      ],
    },
    {
      nome: 'Cremes',
      produtos: [
        {
          nome: 'Creme de Ninho',
          preco: 12,
          descricao: 'Potinho de creme de ninho (300 ml).',
          imagem: 'creme',
        },
        {
          nome: 'Creme de Morango',
          preco: 12,
          descricao: 'Potinho de creme de morango (300 ml).',
          imagem: 'creme',
        },
        {
          nome: 'Creme de Cupuaçu',
          preco: 12,
          descricao: 'Potinho de creme de cupuaçu (300 ml).',
          imagem: 'creme',
        },
        {
          nome: 'Creme de Chocolate',
          preco: 12,
          descricao: 'Potinho de creme de chocolate (300 ml).',
          imagem: 'creme',
        },
      ],
    },
    {
      nome: 'Frutas',
      produtos: [
        {
          nome: 'Banana',
          preco: 6,
          descricao: 'Porção extra de banana.',
          imagem: 'banana',
        },
        {
          nome: 'Morango',
          preco: 8,
          descricao: 'Porção extra de morango.',
          imagem: 'morango',
        },
        {
          nome: 'Manga',
          preco: 8,
          descricao: 'Porção extra de manga.',
          imagem: 'manga',
        },
        {
          nome: 'Kiwi',
          preco: 8,
          descricao: 'Porção extra de kiwi.',
          imagem: 'kiwi',
        },
        {
          nome: 'Uva',
          preco: 6,
          descricao: 'Porção extra de uva.',
          imagem: 'uva',
        },
      ],
    },
    {
      nome: 'Complementos',
      produtos: [
        { nome: 'Leite Ninho', preco: 8 },
        { nome: 'Leite condensado', preco: 6 },
        { nome: 'Paçoca', preco: 6 },
        { nome: 'Granola', preco: 6 },
        { nome: 'Granulado', preco: 5 },
        { nome: 'Coco ralado', preco: 6 },
        { nome: 'Castanha', preco: 9 },
        { nome: 'Amendoim', preco: 5 },
        { nome: 'Bis', preco: 8 },
        { nome: 'Ovomaltine', preco: 6 },
        { nome: 'Confete de chocolate', preco: 5 },
        { nome: 'Calda de chocolate', preco: 6 },
        { nome: 'Calda de morango', preco: 6 },
        { nome: 'Calda de caramelo', preco: 6 },
      ],
    },
    {
      nome: 'Bebidas',
      produtos: [
        { nome: 'Coca-Cola lata', preco: 6.5, imagem: 'lata-refrigerante' },
        { nome: 'Guaraná lata', preco: 5.5, imagem: 'lata-refrigerante' },
        { nome: 'Água mineral', preco: 3, imagem: 'agua' },
        { nome: 'Suco de laranja', preco: 9, imagem: 'laranja' },
      ],
    },
  ],
};

const MODELOS: Record<TipoModelo, CardapioModelo> = {
  lanches: MODELO_LANCHES,
  pizzaria: MODELO_PIZZARIA,
  acai: MODELO_ACAI,
};

/** Rótulo de exibição dos modelos (o front usa a mesma lista). */
export const ROTULOS_MODELO: { tipo: TipoModelo; rotulo: string }[] =
  TIPOS_MODELO.map((tipo) => ({ tipo, rotulo: MODELOS[tipo].rotulo }));

export function ehTipoModelo(valor: unknown): valor is TipoModelo {
  return (
    typeof valor === 'string' &&
    (TIPOS_MODELO as readonly string[]).includes(valor)
  );
}

export function modeloDoTipo(tipo: TipoModelo): CardapioModelo {
  return MODELOS[tipo];
}

/**
 * Tipo da lanchonete → modelo sugerido. `sorvetes` cai no de açaíteria (mesma
 * estrutura de base + complementos) e loja sem tipo cai no de lanchonete.
 */
export function modeloSugerido(
  tipoDaLoja: string | null | undefined,
): TipoModelo {
  if (
    tipoDaLoja === 'pizzaria' ||
    tipoDaLoja === 'acai' ||
    tipoDaLoja === 'sorvetes'
  ) {
    return tipoDaLoja === 'pizzaria' ? 'pizzaria' : 'acai';
  }
  return 'lanches';
}

/** Quantidades do modelo (mostradas na confirmação do front). */
export function resumoDoModelo(modelo: CardapioModelo) {
  return {
    categorias: modelo.categorias.length,
    produtos: modelo.categorias.reduce((acc, c) => acc + c.produtos.length, 0),
    grupos: modelo.grupos.length,
    opcoes: modelo.grupos.reduce((acc, g) => acc + g.opcoes.length, 0),
    /** Produtos que pedem imagem (o front avisa quando a galeria está vazia). */
    comImagem: modelo.categorias.reduce(
      (acc, c) => acc + c.produtos.filter((p) => Boolean(p.imagem)).length,
      0,
    ),
  };
}

/** Palavras-chave de imagem usadas por um modelo (sem repetir). */
export function chavesDeImagem(modelo: CardapioModelo): string[] {
  const chaves = new Set<string>();
  for (const categoria of modelo.categorias) {
    for (const produto of categoria.produtos) {
      if (produto.imagem) chaves.add(produto.imagem);
    }
  }
  return [...chaves];
}
