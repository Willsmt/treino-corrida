# Corrida a dois

Plano de 12 semanas para voltar a correr 5 km, com página de acompanhamento que grava numa planilha do Google. Sem servidor próprio: a página é estática (GitHub Pages) e o Apps Script faz o papel de API.

## O plano

| Nível | Fase | Semanas | Objetivo |
|---|---|---|---|
| Macrociclo | 12 semanas | 1–12 | Fechar 5 km juntos na segunda da semana 12 |
| Mesociclo 1 | Adaptação | 1–4 | Criar o hábito, sempre em ritmo de conversa |
| Mesociclo 2 | Base | 5–8 | Mais tempo correndo, menos pausas de caminhada |
| Mesociclo 3 | Contínuo | 9–12 | Blocos longos, polimento na 11 e teste na 12 |

- **Semanas de descarga:** 4 e 8 (20–40% menos tempo correndo). A 11 é o polimento antes do teste.
- **Microciclo (3 sessões):** A = segunda, juntos; B = leve, meio da semana; C = intermediário, fim de semana.
- **Duas trilhas:** a sessão A é a mesma para os dois (o ritmo de quem está começando manda). B e C seguem a trilha de cada um: *iniciante* (Suellen) e *retorno* (Willians). O retorno ganha fartlek leve nas semanas 9 e 10.
- **Intensidade por esforço (1–10), não por pace.** 3–4 é ritmo de conversa. Na esteira: inclinação 1% e o mesmo critério.
- **Toda sessão:** 5 min caminhando antes e 5 depois.
- Os testes garantem as regras: progressão de no máximo 15% entre semanas de carga, descarga de 20–40% e nenhuma sessão acima de 60 min.

A fonte única do plano é `js/plan.js`. A aba **Plano** da planilha é só uma visão para consulta: editar lá não muda a página.

## Estrutura

```
index.html            página
css/style.css         visual
js/plan.js            plano (macro, meso, micro) e export CSV
js/logic.js           regras puras: datas, validação, totais
js/api.js             cliente do Apps Script
js/app.js             render, estado e sincronização
js/config.js          URL da API e data de início (sem segredos)
apps-script/Code.gs   backend na planilha
data/plano.csv        plano em planilha (gerado)
scripts/export-csv.js gera data/plano.csv
tests/                plano, lógica e fumaça da página (jsdom)
```

## Configurar a planilha (uma vez)

1. Crie uma planilha no Google Sheets. Em **Arquivo > Importar**, envie `data/plano.csv` com *Inserir nova planilha* e renomeie a aba para `Plano`.
2. Na planilha, abra **Extensões > Apps Script** e cole o conteúdo de `apps-script/Code.gs`.
3. Em **Configurações do projeto > Propriedades do script**, crie `ACCESS_KEY` com uma frase longa que só vocês dois conhecem. Não escreva a chave no código.
4. Rode a função `setup` uma vez para criar a aba `Registro` (autorize o acesso quando pedir).
5. **Implantar > Nova implantação > App da Web**, executando como *Eu* e com acesso para *Qualquer pessoa*. Copie a URL que termina em `/exec`.
6. Cole a URL em `API_URL`, dentro de `js/config.js`, e confira `START_DATE` (a segunda da semana 1).

Se mudar o `Code.gs` depois, use **Gerenciar implantações > Editar > Nova versão**; a URL continua a mesma.

## Publicar

```bash
git add . && git commit -m "feat(tracker): página de acompanhamento de treino"
git push
```

No GitHub: **Settings > Pages**, branch `main`, pasta raiz. Cada um abre o link, escolhe o próprio nome e informa a chave uma vez por aparelho.

## Como funciona a persistência

- Cada marcação é um `upsert` por atleta + sessão (aba `Registro`, uma linha por par). Marcar de novo atualiza a linha.
- Sem conexão, o registro fica no aparelho e vai para a planilha na próxima atualização (ao reabrir a página, voltar à aba ou clicar em *Atualizar agora*).
- Com `API_URL` vazio, a página roda em modo local: tudo fica só no navegador.

## Segurança

- A URL `/exec` é pública por natureza. Quem protege é a `ACCESS_KEY`, validada no servidor; ela fica no localStorage de cada aparelho e fora do Git.
- A chave não identifica a pessoa: quem a tiver pode gravar como qualquer atleta. Para dois amigos isso basta; para mais gente, o caminho é login por usuário.
- O servidor valida atleta, formato da sessão, faixas numéricas e limita o tamanho do corpo e da observação. A página monta o DOM com `textContent` (sem `innerHTML`) e tem Content-Security-Policy.

## Desenvolvimento

```bash
npm install
npm test            # plano, lógica e página (jsdom)
npm run plan:csv    # regenera data/plano.csv após mexer em js/plan.js
```

Antes de começar a correr: se algum dos dois ficou muito tempo parado ou tem qualquer questão cardíaca ou articular, vale um check-up. Dor que passa de 3 dias: troque a corrida por caminhada, bicicleta ou natação e procure um médico.

## Fontes do desenho do plano

Corrida/caminhada em 3 dias por semana, semana de descarga a cada 3–4 semanas, aumento gradual de volume e controle por esforço percebido (RRCA, England Athletics, Active, CEP, correrjuntos.com e outros planos de 5K para iniciantes).
