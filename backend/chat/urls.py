from django.urls import path
from .views import (
    delete_conversation, get_messages, rename_conversation, send_message, login_user,
    logout_view, delete_message, get_conversations, create_conversation,
    search_users, send_request, get_requests, accept_request, reject_request, get_friends,
    add_user_to_convo, signup_user, edit_profile
)

urlpatterns = [
    path('messages/<int:conversation_id>/', get_messages),
    path('send/', send_message),
    path('login/', login_user),
    path('signup/', signup_user),
    path('edit-profile/', edit_profile),
    path('logout/', logout_view),
    path('delete/<int:message_id>/', delete_message),
    path('search-users/', search_users),
    path('send-request/', send_request),
    path('requests/<int:user_id>/', get_requests),
    path('accept-request/<int:req_id>/', accept_request),
    path('reject-request/<int:req_id>/', reject_request),
    path('friends/<int:user_id>/', get_friends),
    path('conversations/', get_conversations),
    path('create-conversation/', create_conversation),
    path('rename/<int:convo_id>/', rename_conversation),
    path('invite/<int:convo_id>/', add_user_to_convo),
    path('delete-conversation/<int:convo_id>/', delete_conversation),
]