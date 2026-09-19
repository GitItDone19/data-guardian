"""
Main FastAPI Application Entrypoint for DataGuardian.
Exposes REST API for the Next.js Operational Dashboard and orchestration webhooks.
"""

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from backend.api.routes import router as api_router

load_dotenv()

BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))
ENV = os.getenv("ENV", "development")

app = FastAPI(
    title="DataGuardian API",
    description="Autonomous Agentic DataOps Platform Management Backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware for Next.js Frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8501",
    "*"  # In development, permit local dev tools
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST API Router
app.include_router(api_router)


@app.get("/")
def root():
    return {
        "platform": "DataGuardian",
        "description": "Agentic DataOps Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
