import { describe, expect, it } from 'vitest';
import { validaRespostaEncerramento } from './encerramento.types.js';

// O campo aberto do questionário é o único lugar onde o usuário escreve livre —
// e é a porta de entrada mais óbvia de dado de terceiro dentro do banco (a
// pessoa colaga o telefone do amigo para "reclamar da entrega"). A redação é
// best-effort por desenho: não tenta adivinhar nome, só remove o que dá para
// casar com regex.
const MARCA = '[dado removido]';

function textoExtra(campo: string, valor: string): string | null {
  const resposta = validaRespostaEncerramento('cliente', {
    motivoPrincipal: 'outro',
    satisfacao: 3,
    melhorar: valor,
  } as Record<string, unknown>);
  return resposta[campo as 'melhorar'];
}

describe('redação de dado pessoal no questionário', () => {
  it('remove e-mail do campo aberto', () => {
    const texto = textoExtra('melhorar', 'Falha no app, escrevo em marina.souza@exemplo.com.br');
    expect(texto).not.toContain('marina.souza');
    expect(texto).toContain(MARCA);
  });

  it('remove telefone com DDD, com e sem máscara', () => {
    for (const telefone of ['11987654321', '(11) 98765-4321', '11 98765-4321', '+55 11 98765-4321']) {
      const texto = textoExtra('melhorar', `Meu número é ${telefone}, me liguem`);
      expect(texto, telefone).not.toMatch(/\d{8,}/);
      expect(texto, telefone).toContain(MARCA);
    }
  });

  it('remove documento (CPF formatado e cru)', () => {
    expect(textoExtra('melhorar', 'cpf 123.456.789-09')).not.toContain('456');
    expect(textoExtra('melhorar', 'cpf 12345678909')).not.toContain('12345678909');
  });

  it('não mutila texto sem dado pessoal (inclusive preço e horário)', () => {
    const original = 'Cobraram R$ 12,90 de taxa e o pedido saiu 20:35 — quero cupom.';
    expect(textoExtra('melhorar', original)).toBe(original);
  });

  it('não deixa cauda de número/protocolo vivo (o telefone casava por prefixo)', () => {
    for (const numero of [
      'protocolo 9988776655443322',
      'protocolo 9988776655443322 aberto',
      'pedido 12345678901234567890',
      'matricula 12345678',
    ]) {
      const texto = textoExtra('melhorar', numero);
      expect(texto, numero).not.toMatch(/\d{5,}/);
      expect(texto, numero).toContain(MARCA);
    }
  });

  it('redige o telefone mascarado sem comer o resto da frase', () => {
    const texto = textoExtra('melhorar', 'meu telefone é (11) 98765-4321, pode ligar');
    expect(texto).toContain('meu telefone é');
    expect(texto).toContain('pode ligar');
    expect(texto).not.toMatch(/\d{4,}/);
  });

  it('não quebra o contato autorizado (esse é o campo da pessoa, validado)', () => {
    const resposta = validaRespostaEncerramento('lanchonete', {
      motivoPrincipal: 'sem_pedidos',
      motivosSecundarios: ['preco'],
      ajudouPedidos: 'nao_consegui',
      satisfacao: 2,
      contatoLiberado: true,
      contato: '(11) 98765-4321',
    } as Record<string, unknown>);
    expect(resposta.contato).toBe('+5511987654321');
    expect(resposta.contatoLiberado).toBe(true);
  });

  it('redige também o campo condicional da lanchonete', () => {
    const resposta = validaRespostaEncerramento('lanchonete', {
      motivoPrincipal: 'falta_recurso',
      motivosSecundarios: ['recursos_faltantes'],
      ajudouPedidos: 'nao_consegui',
      funcionalidadeFaltante: 'Falar no 11999998888 sobre a integração',
    } as Record<string, unknown>);
    expect(resposta.funcionalidadeFaltante).toContain(MARCA);
    expect(resposta.funcionalidadeFaltante).not.toMatch(/\d{8,}/);
  });
});