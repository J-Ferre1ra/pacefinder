# Pacefinder

**Descoberta e geração de percursos para corrida.**

Pacefinder é um protótipo web que explora como um aplicativo de corrida pode ajudar a pessoa a decidir onde treinar. Ela escolhe uma região, informa a distância desejada e uma preferência de terreno; o sistema mostra uma rota caminhável aproximada no mapa.

> **Esta é a primeira versão do projeto.** Ela valida o fluxo principal e a integração com mapas, mas ainda usa opções e informações genéricas em partes importantes da experiência. Não representa uma recomendação esportiva completa nem um serviço de segurança ou navegação para corrida.

## Por que este projeto existe

Aplicativos de corrida acompanham atividades e desempenho, mas nem sempre ajudam a escolher um percurso que combine com o objetivo do treino. Uma distância ou ritmo planejado pode ser mais difícil de cumprir em um trajeto com subidas ou características desconhecidas.

O Pacefinder investiga uma pergunta: **como conectar o objetivo do treino ao lugar onde a pessoa vai correr?** A proposta é um módulo que poderia complementar uma plataforma de corrida existente, sem substituir GPS, histórico de atividades ou acompanhamento de desempenho.

## O que a primeira versão permite fazer

1. Buscar um bairro, cidade ou endereço e posicionar o mapa.
2. Escolher o ponto de partida tocando no mapa ou solicitar a localização atual ao navegador.
3. Ajustar uma distância aproximada entre 2 e 15 km.
4. Selecionar uma preferência de terreno: qualquer, plano ou com subidas.
5. Solicitar uma volta aproximada e visualizar sua geometria no Google Maps.

O botão **Como usar** apresenta um guia curto para esse fluxo. A interface também funciona em telas móveis; para testar em outro aparelho durante o desenvolvimento, consulte [Acesso pelo celular](#acesso-pelo-celular).

## O que é real e o que ainda é genérico

| Parte do protótipo | Situação na primeira versão |
| --- | --- |
| Mapa, busca de endereço e geometria da rota | Usa serviços do Google Maps quando a Demo Key está configurada. |
| Distância e terreno escolhidos | São enviados ao gerador, mas a distância final é aproximada e o terreno não é conferido com dados de elevação. |
| Sugestões em cartões | São opções demonstrativas; não correspondem a percursos reais da região pesquisada. |
| Popularidade e áreas de atividade | São dados simulados, sem telemetria de corredores. |
| Avaliações, tempo e elevação dos cartões | São valores fictícios, sem avaliações reais ou análise de altimetria. |
| Iluminação, segurança e infraestrutura | Não são avaliadas pelo sistema. |

O cálculo atual usa a Routes API no modo de deslocamento a pé (`WALK`) e pontos intermediários estimados ao redor da origem para tentar formar uma volta. Uma rota para pedestres não garante calçadas, iluminação, segurança, acessibilidade ou adequação à corrida. A distância solicitada também pode diferir da distância retornada; confira o percurso antes de utilizá-lo.

## Tecnologias

- React 19, TypeScript e Vite para a interface.
- CSS responsivo para os layouts desktop e mobile.
- Cloudflare Workers para os endpoints da API hospedada, com Express mantido como adaptador local opcional.
- Cloudflare Vite plugin e Wrangler para executar, compilar e publicar interface e API como uma aplicação.
- Google Maps JavaScript API para renderizar e interagir com o mapa.
- Geocoding API v4 para converter o endereço pesquisado em coordenadas.
- Routes API para solicitar o percurso caminhável.

## Como executar localmente

Requisitos: Node.js **20.19 ou superior** ou **22.12 ou superior**.

```bash
git clone https://github.com/J-Ferre1ra/pacefinder.git
cd pacefinder
npm install
```

Para iniciar interface e API no runtime local da Cloudflare Workers:

```bash
npm run dev
```

Abra `http://localhost:5173`. O Vite serve a interface e executa os endpoints `/api` no mesmo runtime Workers usado no deploy. Isso reduz diferenças entre desenvolvimento e produção.

O adaptador Express pode ser iniciado isoladamente para estudar ou comparar a execução Node local:

```bash
npm run dev:api
```

Ele atende em `http://localhost:8787` por padrão e compartilha as mesmas regras HTTP usadas pelo Worker.

## Configurar o Google Maps Demo Key

Sem chave, a aplicação abre em modo demonstrativo e exibe mapas e percursos ilustrativos. Para ativar a integração com o Google Maps:

1. Solicite uma [Maps Demo Key](https://developers.google.com/maps/documentation/javascript/demo-key) na sua conta Google e siga as instruções oficiais. A Demo Key é destinada a prototipagem, não exige configuração de faturamento e possui limites de uso.
2. Copie `.env.example` para `.env`:

   ```bash
   cp .env.example .env
   ```

   No PowerShell do Windows, use `Copy-Item .env.example .env`.

3. Preencha a mesma Demo Key nas duas variáveis do `.env`:

   ```dotenv
   VITE_GOOGLE_MAPS_API_KEY=sua_maps_demo_key
   GOOGLE_MAPS_DEMO_API_KEY=sua_maps_demo_key
   PORT=8787
   ```

4. Reinicie `npm run dev` para que o Vite e o runtime Worker carreguem as variáveis.

`VITE_GOOGLE_MAPS_API_KEY` é incluída no JavaScript enviado ao navegador; isso é esperado para esta chave de demonstração. `GOOGLE_MAPS_DEMO_API_KEY` é lida pelo servidor para chamar Geocoding e Routes. O projeto ignora `.env` no Git: **não substitua o `.env.example` pela sua cópia local e não publique credenciais pessoais**. O `.env.example` deve continuar com os valores vazios.

Antes de migrar para chaves com faturamento ou disponibilizar uma versão hospedada, será necessário seguir as recomendações atuais do Google para restrições de origem e de API, quotas, HTTPS e separação entre chaves de navegador e servidor.

## Acesso pelo celular

O servidor de desenvolvimento escuta na rede local. Para testar em um celular:

1. Conecte o celular e o computador à mesma rede Wi-Fi.
2. Descubra o endereço IPv4 local do computador.
3. No navegador do celular, abra `http://<IP-DO-COMPUTADOR>:5173`, substituindo o texto pelo endereço da sua rede.

Se a página não carregar, verifique se o Firewall do Windows permite conexões locais ao Node.js. A busca de regiões funciona pela aplicação; já a localização atual pode ser bloqueada pelo navegador em HTTP, pois geolocalização normalmente exige um contexto seguro, como HTTPS ou `localhost`.

## API local

| Método e caminho | Finalidade |
| --- | --- |
| `GET /api/health` | Informa se os serviços Google estão configurados, sem devolver a chave. |
| `POST /api/geocode` | Recebe `{ "address": "bairro, cidade" }` e retorna rótulo e coordenadas. |
| `POST /api/routes/generate` | Recebe origem, distância desejada e terreno; retorna distância, duração e polyline codificada. |

Os dois endpoints que chamam serviços Google validam as entradas e aplicam limites de dez chamadas por minuto. No Worker, os limites são por endereço IP e por região da Cloudflare; podem ser compartilhados por pessoas na mesma rede e são aproximados, não um sistema de contabilização exata. O adaptador Express local mantém limites independentes para desenvolvimento.

## Publicar na Cloudflare Workers

A interface e a API são publicadas juntas como um Worker com assets estáticos. O Cloudflare Vite plugin integra o build Vite ao runtime Workers; `worker/index.js` encaminha `/api/*` para a API compartilhada e os demais caminhos para os arquivos estáticos do SPA. A configuração prioriza `/api/*` no Worker antes do fallback do SPA, para que uma chamada à API não receba o `index.html` por engano.

Na tela **Workers & Pages → Create application → Continue with GitHub**, conecte o repositório `J-Ferre1ra/pacefinder` e use:

| Configuração | Valor |
| --- | --- |
| Project name | `pacefinder` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |
| Root directory | Deixar em branco |

O nome configurado no painel precisa corresponder a `name` em `wrangler.jsonc`. O build gera o diretório de assets e o arquivo Wrangler de saída usados pelo deploy; não configure `dist` como diretório manualmente nessa tela.

Configure as credenciais em locais diferentes:

- `VITE_GOOGLE_MAPS_API_KEY`: variável de **build** do Worker. Ela aparece no JavaScript entregue ao navegador, portanto é usada somente para o mapa e deve continuar sendo uma Demo Key de prototipagem.
- `GOOGLE_MAPS_DEMO_API_KEY`: segredo de **runtime** do Worker, em **Settings → Variables & Secrets**. O código usa esse segredo para chamar Geocoding e Routes no servidor.

O arquivo `.env` local é ignorado pelo Git. Não o publique; insira cada valor diretamente na configuração apropriada da Cloudflare. Depois de conectar o GitHub, pushes para `main` iniciam novos builds e deploys. O deploy do Pacefinder é independente do outro projeto Pages da conta.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Inicia interface Vite e API no runtime local de Workers. |
| `npm run dev:api` | Inicia o adaptador Express local em modo watch. |
| `npm run build` | Executa a verificação TypeScript e gera a build de produção. |
| `npm run lint` | Analisa o código com Oxlint. |
| `npm run preview` | Pré-visualiza a build no runtime local Cloudflare. |
| `npm run deploy` | Publica a build já gerada com Wrangler. |

## Estrutura principal

```text
src/
  App.tsx             Tela, estado e fluxo principal do produto
  App.css             Componentes visuais e regras responsivas
  GoogleMapPanel.tsx  Mapa Google, busca e desenho da rota
server/
  api-handler.js      Regras HTTP compartilhadas pela API local e pelo Worker
  index.js            Adaptador Express opcional para desenvolvimento local
worker/
  index.js            Entrada da API executada em Cloudflare Workers
wrangler.jsonc        Configuração de deploy, assets e limites de chamadas
```

## Próximas evoluções possíveis

- Trocar cartões, popularidade e avaliações fictícias por rotas e fontes de dados reais, com origem e qualidade documentadas.
- Fazer cada opção recomendada corresponder a uma geometria selecionável no mapa.
- Avaliar dados de elevação para medir a compatibilidade com a preferência de terreno.
- Definir como coletar e moderar feedback da comunidade sem expor a localização individual dos corredores.
- Adicionar testes automatizados para regras de negócio e estados da interface.
- Preparar hospedagem HTTPS, configuração de chaves apropriada e proteção operacional antes de disponibilizar o serviço publicamente.

Esses itens são possibilidades para evoluir o MVP, não funcionalidades já disponíveis.

## Privacidade e decisões

O protótipo não oferece conta de usuário, não salva histórico de pesquisas e não persiste avaliações. Endereços e coordenadas informados são enviados ao Google para executar a busca ou solicitar uma rota; consulte também os termos aplicáveis do provedor. A interface só solicita a localização do dispositivo depois de uma ação explícita, sujeita à permissão do navegador.

As decisões de produto e arquitetura foram registradas em um guia pessoal fora deste repositório. Este README descreve o comportamento implementado nesta versão pública.
