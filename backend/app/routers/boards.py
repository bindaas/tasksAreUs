from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Board
from ..schemas import BoardCreate, BoardOut, BoardUpdate
from ..services import board_service as svc

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=dict)
def list_boards(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    svc.ensure_board_seeded(db, user_id)
    boards = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).order_by(Board.sort_order.asc(), Board.created_at.asc()).all()
    return {"boards": [BoardOut.model_validate(b) for b in boards]}


@router.post("", response_model=BoardOut, status_code=201)
def create_board(
    body: BoardCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    board = svc.create_board(db, user_id, body.name)
    return BoardOut.model_validate(board)


@router.put("/{board_id}", response_model=BoardOut)
def update_board(
    board_id: str,
    body: BoardUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    board = svc.get_board_or_404(db, board_id, user_id)
    color_kwarg = {"color": body.color} if "color" in body.model_fields_set else {}
    board = svc.update_board(db, board, body.name, sort_order=body.sort_order, **color_kwarg)
    return BoardOut.model_validate(board)


@router.delete("/{board_id}", status_code=204)
def delete_board(
    board_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    board = svc.get_board_or_404(db, board_id, user_id)
    svc.delete_board(db, board)
