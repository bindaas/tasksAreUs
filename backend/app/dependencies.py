from fastapi import Header, HTTPException


def get_current_user_id(x_user_id: str = Header(..., alias="X-User-ID")) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-ID header required")
    return x_user_id
