import json
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Extract user_id from query string
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        user_id_list = query_params.get('user_id', None)
        
        if user_id_list:
            self.user_id = user_id_list[0]
            self.user_group_name = f"user_{self.user_id}"

            # Join user's personal group
            await self.channel_layer.group_add(
                self.user_group_name,
                self.channel_name
            )
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            # Leave user's personal group
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    # Receive message from room group
    async def chat_message(self, event):
        message_data = event["message"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            "type": event.get("event_type", "chat_message"),
            "data": message_data
        }))
