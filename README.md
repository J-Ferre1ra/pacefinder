# Pacefinder — Percursos de corrida

Protótipo web de uma funcionalidade de descoberta e recomendação de percursos para corrida. A pessoa pode explorar uma região, visualizar uma camada demonstrativa de atividade e pedir uma rota circular caminhável.

## Estado do produto

- Com uma Maps Demo Key, o mapa Google e a seleção de ponto no mapa ficam ativos sem vincular faturamento.
- A mesma Demo Key é configurada no navegador e no servidor: Maps JavaScript para renderização; Geocoding API v4 e Routes API para busca de endereço e cálculo de rota.
- Sem as chaves, a aplicação continua disponível em modo demonstrativo, com mapa e rotas ilustrativos.
- Popularidade, avaliações, tempo, elevação dos cartões e áreas de atividade são sintéticos. Não representam corredores nem condições reais de qualquer região.
- A rota é pedida no modo `WALK`. O Google informa que caminhos a pé podem estar sem calçadas ou caminhos de pedestres claros; a interface exibe esse aviso. O serviço não valida que o caminho seja apropriado para corrida, iluminado, seguro ou plano. A distância-alvo é aproximada.

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev:all
```

Abra `http://localhost:5173`. O script inicia o Vite e a API Express local. Para iniciar separadamente, use `npm run dev` e `npm run dev:api` em dois terminais.

## Ativar a Maps Demo Key (sem faturamento)

1. Entre na sua conta Google e solicite uma [Maps Demo Key](https://developers.google.com/maps/documentation/javascript/demo-key). O Google pede que você aceite os termos próprios da chave de demonstração.
2. Copie `.env.example` para `.env` e coloque a mesma Demo Key nas duas variáveis:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=sua_maps_demo_key
GOOGLE_MAPS_DEMO_API_KEY=sua_maps_demo_key
PORT=8787
```

3. Reinicie `npm run dev:all`. A Demo Key dá acesso somente a um conjunto de recursos para prototipagem e tem limite diário; se atingir o limite, o Google pausa o serviço até o dia seguinte, sem cobrança. Confira os limites e termos atuais na [documentação da Demo Key](https://developers.google.com/maps/documentation/javascript/demo-key).

O nome `VITE_GOOGLE_MAPS_API_KEY` indica que essa cópia é embutida no navegador. Isso é esperado para a Demo Key de prototipagem e não a transforma em segredo. A variável do servidor permite chamar Geocoding/Routes pelo backend; ela contém a mesma chave, mas não vai para o bundle do navegador. Não comite o arquivo `.env` nem cole a chave no chat.

Uma migração posterior para chaves padrão exigirá configurar faturamento, restringir a chave de navegador por origem e manter uma chave de serviço separada, restrita às APIs usadas.

## Fluxo técnico

1. `GoogleMapPanel` carrega Maps JavaScript API, comunica o ponto escolhido ao React e pede busca de endereço ao endpoint local.
2. O front end envia coordenadas e preferências para `POST /api/routes/generate`.
3. O servidor valida os dados, aplica limite de chamadas e chama Geocoding API v4 ou Routes API usando a Demo Key.
4. A resposta devolve distância, duração e polyline codificada; o front end decodifica a geometria e a desenha no mapa Google.

## Limites conhecidos

- A camada de atividade e os cartões continuam fictícios mesmo com Google Maps conectado.
- A integração atual não coleta telemetria de corredores nem persiste avaliações.
- O gerador cria pontos intermediários ao redor da origem para formar uma volta aproximada; não escolhe esses pontos por popularidade.
- A preferência de terreno ainda não é validada por dados de elevação. O percurso retornado pode não corresponder à preferência.
- A Demo Key é exclusiva para prototipagem, tem recursos e quotas diárias limitados e depende dos termos publicados pelo Google.
- O servidor de desenvolvimento não inclui autenticação de usuário nem armazenamento. Antes de publicar, configure restrições e quotas das chaves, limites operacionais adequados, HTTPS e proteção de origem conforme a hospedagem.

## Stack

- React 19, TypeScript e Vite
- Google Maps JavaScript API e Geocoding API
- Node.js e Express para o endpoint que chama Routes API

As justificativas das decisões de produto e arquitetura ficam no guia pessoal fora deste repositório.
