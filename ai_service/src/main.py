from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from cbf import get_cbf_recommendations
from cf import get_cf_recommendations
from chat import chat_with_ai

app = FastAPI(title="Movie Recommendation AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
def root():
    return {"message": "AI Service is running!"}

@app.get("/recommend/cbf/{user_id}")
def cbf(user_id: int, limit: int = 10):
    result = get_cbf_recommendations(user_id, limit)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/recommend/cf/{user_id}")
def cf(user_id: int, limit: int = 10):
    result = get_cf_recommendations(user_id, limit)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/recommend/hybrid/{user_id}")
def hybrid(user_id: int, limit: int = 10):
    # Try CF first, if not enough data, fallback to CBF
    cf_result = get_cf_recommendations(user_id, limit)
    if "error" not in cf_result:
        cf_result["strategy"] = "collaborative-filtering"
        return cf_result

    cbf_result = get_cbf_recommendations(user_id, limit)
    if "error" not in cbf_result:
        cbf_result["strategy"] = "content-based"
        return cbf_result

    raise HTTPException(
        status_code=400,
        detail="Not enough data for recommendations"
    )

@app.post("/chat")
def chat(request: dict):
    message = request.get("message", "")
    user_id = request.get("user_id")
    history = request.get("history", [])

    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    result = chat_with_ai(message, user_id, history)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result