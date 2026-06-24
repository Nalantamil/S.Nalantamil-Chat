from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
import bcrypt
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-later'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Connect to MongoDB
client = MongoClient("mongodb+srv://tamilsundhar:nalan123456@cluster0.pse786b.mongodb.net/?appName=Cluster0")
db = client["chatapp"]
users_collection = db["users"]
messages_collection = db["messages"]

@app.route('/')
def home():
    return "Backend is running!"

# ---------- SIGNUP ----------
@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    existing_user = users_collection.find_one({"username": username})
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    users_collection.insert_one({"username": username, "password": hashed_pw})
    return jsonify({"message": "Signup successful"}), 201

# ---------- LOGIN ----------
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401
    if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
        return jsonify({"error": "Invalid username or password"}), 401
    token = jwt.encode({
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({"message": "Login successful", "token": token}), 200

# ---------- GET MESSAGES ----------
@app.route('/messages', methods=['GET'])
def get_messages():
    msgs = list(messages_collection.find().sort('timestamp', 1).limit(50))
    for msg in msgs:
        msg['_id'] = str(msg['_id'])
    return jsonify(msgs), 200

# ---------- DELETE MESSAGE ----------
@app.route('/messages/<message_id>', methods=['DELETE'])
def delete_message(message_id):
    from bson.objectid import ObjectId
    messages_collection.delete_one({"_id": ObjectId(message_id)})
    return jsonify({"message": "Deleted"}), 200

# ---------- EDIT MESSAGE ----------
@app.route('/messages/<message_id>', methods=['PUT'])
def edit_message(message_id):
    from bson.objectid import ObjectId
    data = request.json
    messages_collection.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"text": data['text'], "edited": True}}
    )
    return jsonify({"message": "Updated"}), 200

# ---------- SOCKET.IO ----------
online_users = []

@socketio.on('join')
def handle_join(data):
    username = data['username']
    if username not in online_users:
        online_users.append(username)
    emit('online_users', online_users, broadcast=True)
    emit('message', {
        'type': 'system',
        'text': f'{username} joined the chat 👋',
        'timestamp': str(datetime.datetime.utcnow())
    }, broadcast=True)

@socketio.on('send_message')
def handle_message(data):
    message = {
        'username': data['username'],
        'text': data['text'],
        'type': 'user',
        'timestamp': str(datetime.datetime.utcnow()),
        'edited': False
    }
    result = messages_collection.insert_one(message)
    message['_id'] = str(result.inserted_id)
    emit('message', message, broadcast=True)

@socketio.on('delete_message')
def handle_delete(data):
    from bson.objectid import ObjectId
    messages_collection.delete_one({"_id": ObjectId(data['message_id'])})
    emit('message_deleted', {'message_id': data['message_id']}, broadcast=True)

@socketio.on('edit_message')
def handle_edit(data):
    from bson.objectid import ObjectId
    messages_collection.update_one(
        {"_id": ObjectId(data['message_id'])},
        {"$set": {"text": data['text'], "edited": True}}
    )
    emit('message_edited', {
        'message_id': data['message_id'],
        'text': data['text']
    }, broadcast=True)

@socketio.on('leave')
def handle_leave(data):
    username = data['username']
    if username in online_users:
        online_users.remove(username)
    emit('online_users', online_users, broadcast=True)
    emit('message', {
        'type': 'system',
        'text': f'{username} left the chat 👋',
        'timestamp': str(datetime.datetime.utcnow())
    }, broadcast=True)

@socketio.on('typing')
def handle_typing(data):
    emit('user_typing', {'username': data['username']}, broadcast=True, include_self=False)

@socketio.on('stop_typing')
def handle_stop_typing(data):
    emit('user_stop_typing', {'username': data['username']}, broadcast=True, include_self=False)

@socketio.on('add_reaction')
def handle_reaction(data):
    from bson.objectid import ObjectId
    message_id = data['message_id']
    emoji = data['emoji']
    user = data['username']
    
    msg = messages_collection.find_one({"_id": ObjectId(message_id)})
    if not msg:
        return
    
    reactions = msg.get('reactions', {})
    if emoji not in reactions:
        reactions[emoji] = []
    
    if user in reactions[emoji]:
        reactions[emoji].remove(user)
    else:
        reactions[emoji].append(user)
    
    messages_collection.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"reactions": reactions}}
    )
    
    emit('reaction_updated', {
        'message_id': message_id,
        'reactions': reactions
    }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)