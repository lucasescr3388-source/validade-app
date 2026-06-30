# Validade Certa — Controle de Validade para Mercado

PWA (Progressive Web App) para controlar produtos próximos do vencimento, leitura de código de barras pela câmera, fotos de produto e relatório de perdas. Funciona 100% offline, com os dados salvos no próprio dispositivo (localStorage).

## Como hospedar no GitHub Pages (passo a passo)

1. Crie um repositório novo no GitHub (ex: `validade-app`).
2. Suba todos os arquivos desta pasta (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.json`, pasta `icons/`) para a raiz do repositório.
3. No repositório, vá em **Settings → Pages**.
4. Em "Source", selecione a branch `main` (ou `master`) e a pasta `/ (root)`.
5. Salve. Em alguns minutos o GitHub vai gerar uma URL tipo:
   `https://seu-usuario.github.io/validade-app/`
6. Abra essa URL no celular (Chrome ou Safari) e use a opção **"Adicionar à tela inicial"** / **"Instalar app"** — o app vai funcionar como um aplicativo nativo, com ícone próprio e offline.

> Importante: o GitHub Pages serve via HTTPS, requisito obrigatório para a câmera (leitura de código de barras) funcionar.

## Funcionalidades

- **Aba "Vencendo"**: mostra primeiro os itens urgentes (vermelho) e em atenção (amarelo).
- **Aba "Todos"** e **"Vencidos"**: visão completa e itens já fora do prazo.
- **Classificação automática por cor**:
  - 🔴 Vermelho: vencido ou vence em até 3 dias
  - 🟡 Amarelo: vence em até 10 dias
  - 🟢 Verde: sem urgência
- **Leitura de código de barras pela câmera** (usa a API nativa `BarcodeDetector` do navegador — suportada no Chrome/Edge Android e em boa parte dos navegadores modernos; quando não suportado, permite digitar manualmente).
- **Foto do produto**: tire foto ou escolha da galeria; a imagem fica salva junto ao cadastro.
- **Unidades de medida**: unidade, caixa, kg, pacote.
- **Filtros**: por categoria, unidade e nível de urgência, além de busca livre por nome/código de barras/categoria.
- **Dar baixa em um item**: ao tocar num item, escolha entre "Vendido", "Vendido com desconto" e "Perda/Vencido" — isso alimenta o relatório de perdas.
- **Relatório de perdas**: total de itens perdidos, prejuízo em R$, vendas com desconto e perdas por categoria.
- **Exportar/Importar**: backup em `.json` (com histórico) e exportação em `.csv` para abrir em Excel/Planilhas Google.
- **Sugestões de redução de perdas**: tela com boas práticas (FEFO, desconto progressivo, doação, etc).

## Sobre a busca de imagem pelo código de barras

Por decisão de projeto, o app **não busca automaticamente a foto do produto na internet** — você mesmo tira a foto na hora do cadastro. Isso evita depender de APIs externas (pagas, com limite de uso, ou sem cobertura para produtos nacionais), tornando o app mais confiável e 100% funcional offline.

## Sugestões de evolução (próximos passos)

- Sincronização em nuvem (ex: Firebase/Supabase) para múltiplos dispositivos e funcionários.
- Notificações push reais (hoje o app usa notificação local básica do navegador).
- Login multiusuário com permissões (gerente vs operador de loja).
- Integração com leitor de código de barras físico (USB/Bluetooth) via teclado emulado.
- Sugestão automática de % de desconto conforme dias restantes.
- Modo "conferência de prateleira" com lista de itens a verificar fisicamente, fora a tela de cadastro.

## Estrutura de arquivos

```
validade-app/
├── index.html       → estrutura da interface
├── styles.css        → identidade visual
├── app.js             → toda a lógica (cadastro, filtros, scanner, relatório)
├── sw.js               → service worker (cache offline)
├── manifest.json    → configuração do PWA
└── icons/                → ícones do app
```
