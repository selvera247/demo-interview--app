# Chris Selvera — portfolio demos

Personal portfolio and interview demos for AI-native finance transformation work.

**Live (GitHub Pages):** https://selvera247.github.io/demo-interview--app/

## What’s here

1. **Portfolio** — hero, headline metrics, project index  
2. **Finance MCP Server + Close Agent** — synthetic GL/AR, MCP tools, FastAPI/LangGraph workflow, review queue, eval score 23/23 (`finance-close-agent/`)  
3. **Deal Record** — spec intake, sourcing, and cost tracking on one project ID  

All Close Agent figures are **synthetic demo data**.

## Local (portfolio + demos)

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/

Routes (hash router for GitHub Pages):

- `/#/` — portfolio  
- `/#/projects/close-agent` — case study + interactive review demo  
- `/#/projects/deal-record` — Deal Record app  

## Finance Close Agent (Python / MCP)

```bash
cd finance-close-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py
python agent/close_agent.py
uvicorn api.main:app --reload --port 8000   # LangGraph workflow API
streamlit run ui/review_app.py
python evals/run_evals.py   # expect 23/23
```

Or with Docker (API + Streamlit):

```bash
cd finance-close-agent
docker compose up --build
```

See [`finance-close-agent/README.md`](finance-close-agent/README.md) for Claude Desktop MCP config and API routes.

## Build

```bash
npm run build
```
