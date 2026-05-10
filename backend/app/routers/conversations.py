from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user_id
from ..models import Conversation, Message
from ..schemas import (
    ConversationOut, MessageActions, MessageOut,
    MessageRequest, SendMessageResponse,
)
from ..services import ai_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationOut, status_code=201)
def start_conversation(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    conv = Conversation(user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationOut.model_validate(conv)


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse)
def send_message(
    conversation_id: str,
    body: MessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from fastapi import HTTPException
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    assistant_msg, tasks_created, tasks_completed = ai_service.handle_conversation_message(
        db=db,
        conversation=conv,
        user_content=body.content,
        user_id=user_id,
    )
    return SendMessageResponse(
        message=MessageOut.model_validate(assistant_msg),
        actions=MessageActions(
            tasks_created=tasks_created,
            tasks_completed=tasks_completed,
        ),
    )


@router.get("/{conversation_id}/messages", response_model=dict)
def get_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from fastapi import HTTPException
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
    ).order_by(Message.created_at.asc()).all()
    return {"messages": [MessageOut.model_validate(m) for m in messages]}
