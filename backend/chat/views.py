from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Message, Conversation, ConnectionRequest
from .serializers import MessageSerializer, ConnectionRequestSerializer
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

@api_view(['GET'])
def search_users(request):
    query = request.GET.get('q', '')
    if query:
        users = User.objects.filter(username__icontains=query)
        # Exclude logged in user roughly by using user_id from query if passed, since session might not be configured cleanly
        user_id = request.GET.get('user_id')
        if user_id:
            users = users.exclude(id=user_id)
        data = [{"id": u.id, "username": u.username, "display_name": u.first_name} for u in users]
        return Response(data)
    return Response([])

@api_view(['POST'])
def send_request(request):
    sender_id = request.data.get('sender_id')
    receiver_id = request.data.get('receiver_id')
    if not sender_id or not receiver_id:
        return Response({"error": "Missing IDs"}, status=400)
    
    sender = get_object_or_404(User, id=sender_id)
    receiver = get_object_or_404(User, id=receiver_id)
    
    if ConnectionRequest.objects.filter(sender=sender, receiver=receiver).exists() or ConnectionRequest.objects.filter(sender=receiver, receiver=sender).exists():
         return Response({"error": "Request already exists or connected"}, status=400)
         
    req = ConnectionRequest.objects.create(sender=sender, receiver=receiver)
    
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{receiver.id}",
        {
            "type": "chat_message",
            "event_type": "new_request",
            "message": {"id": req.id}
        }
    )
    
    return Response({"status": "Request sent", "id": req.id})

@api_view(['GET'])
def get_requests(request, user_id):
    requests = ConnectionRequest.objects.filter(receiver_id=user_id, status='pending')
    serializer = ConnectionRequestSerializer(requests, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def accept_request(request, req_id):
    req = get_object_or_404(ConnectionRequest, id=req_id)
    req.status = 'accepted'
    req.save()
    
    convo = Conversation.objects.create(name=f"{req.sender.username} and {req.receiver.username}")
    convo.participants.add(req.sender, req.receiver)
    
    channel_layer = get_channel_layer()
    for u_id in [req.sender.id, req.receiver.id]:
        async_to_sync(channel_layer.group_send)(
            f"user_{u_id}",
            {
                "type": "chat_message",
                "event_type": "request_accepted",
                "message": {"conversation_id": convo.id}
            }
        )
    
    return Response({"status": "accepted", "conversation_id": convo.id})

@api_view(['POST'])
def reject_request(request, req_id):
    req = get_object_or_404(ConnectionRequest, id=req_id)
    req.status = 'rejected'
    req.save()
    return Response({"status": "rejected"})

@api_view(['GET'])
def get_friends(request, user_id):
    requests = ConnectionRequest.objects.filter(
        (Q(sender_id=user_id) | Q(receiver_id=user_id)),
        status='accepted'
    )
    friends = []
    for req in requests:
        if req.sender_id == int(user_id):
            friends.append({"id": req.receiver.id, "username": req.receiver.username, "display_name": req.receiver.first_name})
        else:
            friends.append({"id": req.sender.id, "username": req.sender.username, "display_name": req.sender.first_name})
    
    unique_friends = {f['id']: f for f in friends}.values()
    return Response(list(unique_friends))

@api_view(['GET'])
def get_conversations(request):
    user_id = request.GET.get('user_id')
    if user_id:
        convos = Conversation.objects.filter(participants__id=user_id).prefetch_related('participants').order_by('created_at')
    else:
        convos = Conversation.objects.prefetch_related('participants').all().order_by('created_at')

    data = []
    for c in convos:
        participants = [{"id": p.id, "username": p.username, "display_name": p.first_name} for p in c.participants.all()]
        # Determine if it's a group (either strictly >2 members, or specifically created as one). For now >2.
        # But wait, what if someone created a group with 2 members?
        # Let's say if it has exactly 2 members, it's a thread. If >2, it's a group. If 1, it's also a thread with oneself.
        is_group = len(participants) > 2
        
        data.append({
            "id": c.id,
            "display_name": c.name if c.name else "",
            "participants": participants,
            "is_group": is_group
        })

    return Response(data)

@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({"message": "Logged out"})

@api_view(['DELETE'])
def delete_message(request, message_id):
    message = get_object_or_404(Message, id=message_id)
    message.delete()
    return Response({"message": "Deleted"})

@api_view(['GET'])
def get_messages(request, conversation_id):
    messages = Message.objects.filter(conversation_id=conversation_id).order_by('timestamp')
    serializer = MessageSerializer(messages, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@csrf_exempt
def send_message(request):
    data = request.data.copy()
    if request.user.is_authenticated:
        data['sender'] = request.user.id
    serializer = MessageSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        
        channel_layer = get_channel_layer()
        message_data = serializer.data
        convo = Conversation.objects.get(id=message_data['conversation'])
        
        for participant in convo.participants.all():
            async_to_sync(channel_layer.group_send)(
                f"user_{participant.id}",
                {
                    "type": "chat_message",
                    "event_type": "new_message",
                    "message": message_data
                }
            )

        return Response(serializer.data)
    return Response(serializer.errors)

@api_view(['POST'])
@csrf_exempt
def login_user(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(username=username, password=password)
    if user:
        login(request, user)
        return Response({
            "message": "Login successful",
            "user_id": user.id,
            "username": user.username,
            "display_name": user.first_name
        })
    return Response({"error": "Invalid credentials"}, status=400)

@api_view(['POST'])
@csrf_exempt
def signup_user(request):
    username = request.data.get("username")
    password = request.data.get("password")
    display_name = request.data.get("display_name", "")
    
    if not username or not password:
        return Response({"error": "Username and password required"}, status=400)
        
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already taken"}, status=400)
        
    user = User.objects.create_user(username=username, password=password, first_name=display_name)
    login(request, user)
    
    return Response({
        "message": "Signup successful",
        "user_id": user.id,
        "username": user.username,
        "display_name": user.first_name
    })

@api_view(['POST'])
@csrf_exempt
def edit_profile(request):
    user_id = request.data.get("user_id")
    display_name = request.data.get("display_name")
    
    if not user_id:
        return Response({"error": "User ID required"}, status=400)
        
    user = get_object_or_404(User, id=user_id)
    user.first_name = display_name
    user.save()
    
    return Response({"status": "updated", "display_name": user.first_name})

@api_view(['POST'])
def create_conversation(request):
    user_ids = request.data.get("user_ids", [])
    if request.data.get("user_id") and request.data.get("user_id") not in user_ids:
        user_ids.append(request.data.get("user_id"))
        
    convo = Conversation.objects.create()
    if user_ids:
        users = User.objects.filter(id__in=user_ids)
        convo.participants.add(*users)
        
    creator_id = request.data.get("creator_id")
    if creator_id:
        creator = User.objects.get(id=creator_id)
        convo.participants.add(creator)

    return Response({"id": convo.id})

@api_view(['POST'])
def rename_conversation(request, convo_id):
    convo = Conversation.objects.get(id=convo_id)
    convo.name = request.data.get("name")
    convo.save()
    return Response({"status": "updated"})

@api_view(['POST'])
def add_user_to_convo(request, convo_id):
    user_id = request.data.get("user_id")
    convo = Conversation.objects.get(id=convo_id)
    user = User.objects.get(id=user_id)
    convo.participants.add(user)
    return Response({"status": "added"})

@api_view(['DELETE'])
def delete_conversation(request, convo_id):
    convo = get_object_or_404(Conversation, id=convo_id)
    convo.delete()
    return Response({"status": "deleted"})