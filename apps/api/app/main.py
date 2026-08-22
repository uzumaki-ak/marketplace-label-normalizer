from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import Base, engine
from .routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Marketplace Shipping Label Normalizer API",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(router)
