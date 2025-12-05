# Survey Frontend

Interface em React + TypeScript para consumir a [survey-api](../survey-api) e facilitar o gerenciamento de pesquisas, perguntas e opções de resposta em um visual branco e verde minimalista.

## Principais recursos

- Dashboard com listagem das pesquisas, filtro por status e atalho para ver a estrutura completa
- Formulário para criação rápida de pesquisas (título, status e data de validade)
- Página de detalhes com visão das perguntas/opções da pesquisa e formulários para adicionar perguntas e opções
- Feedbacks visuais para estados de carregamento e erros vindos da API

## Stack

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [React Router](https://reactrouter.com/)
- [Axios](https://axios-http.com/)

## Pré-requisitos

- Node.js 20+
- npm 10+
- Instância da survey-api rodando (por padrão em `http://localhost:8080/api`)

## Como rodar

```bash
npm install
npm run dev
```

O Vite indicará a porta (por padrão `http://localhost:5173`). A API já está com CORS liberado para essa origem no README original.

## Variáveis de ambiente

| Variável              | Descrição                                                  | Default                      |
| --------------------- | ---------------------------------------------------------- | ---------------------------- |
| `VITE_API_BASE_URL`   | URL base da survey-api (inclua o prefixo `/api`).          | `http://localhost:8080/api`  |
| `VITE_PUBLIC_SURVEY_BASE_URL` | URL base da pesquisa pública (onde o respondente abre a survey). | `http://localhost:5173/surveys` |

Crie um arquivo `.env` se precisar alterar o endpoint:

```env
VITE_API_BASE_URL=http://localhost:8081/api
VITE_PUBLIC_SURVEY_BASE_URL=http://localhost:5174/surveys
```

## Estrutura de pastas

```
src/
├── components/       # Layout base
├── pages/            # Telas (listagem e detalhes)
├── services/         # Cliente HTTP/integrações com a API
├── types/            # Modelos compartilhados
├── App.tsx           # Definição das rotas
└── main.tsx          # Bootstrap da aplicação
```

## Próximos passos sugeridos

- Adicionar autenticação (se a API exigir no futuro)
- Implementar edição/remoção de perguntas e opções
- Cobrir o fluxo de submissão das respostas do público final
