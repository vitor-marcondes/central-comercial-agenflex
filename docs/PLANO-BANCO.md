# Plano do banco — requisitos já definidos

## Tabelas do MVP

- `perfis`
- `propostas`
- `revisoes_proposta`
- `itens_revisao`

## Regra de histórico

### Rascunho
Pode ser atualizado.

### Enviada
Não deve perder a versão original. Uma alteração deve criar nova revisão.

Exemplo:

```text
Proposta #152
R0 — 10.000 UN — ENVIADA
R1 — 15.000 UN — ENVIADA
R2 — 20.000 UN — RASCUNHO
```

## Duplicar proposta

Duplicar não é revisão. Gera uma NOVA proposta com os dados copiados para o vendedor alterar apenas o necessário.

## Dados que devem voltar ao abrir uma proposta

- razão social / cliente
- nome fantasia
- comprador
- CNPJ
- IE
- telefone
- e-mail
- endereço
- bairro
- cidade / UF / CEP
- escolha de logo/time
- validade
- clichê
- pagamento
- vendedor
- projeto
- previsão de faturamento
- destinação
- frete
- regras comerciais
- opção mostrar totais
- todos os itens, observações, NCM, quantidade, unidade, valor unitário e IPI

## Não salvar inicialmente

- arquivos de arte/imagem anexados ao PDF
