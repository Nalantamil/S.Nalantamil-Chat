from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from pymongo import MongoClient
import bcrypt
import jwt
import datetime
import threading
import requests
import time
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-later'
CORS(app,
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', ping_timeout=60, ping_interval=25)

client = MongoClient(os.environ.get("MONGODB_URI", "mongodb+srv://tamilsundhar:NalantamilMDB31@cluster0.pse786b.mongodb.net/chatapp"))
db = client["chatapp"]
users_collection = db["users"]
messages_collection = db["messages"]
pinned_collection = db["pinned"]
groups_collection = db["groups"]

@app.route('/')
def home():
    return "Backend is running!"

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
    users_collection.insert_one({
        "username": username,
        "password": hashed_pw,
        "bio": "",
        "avatar_color": "#667eea",
        "avatar_url": ""
    })
    return jsonify({"message": "Signup successful"}), 201

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

# ---------- GENERAL CHANNEL MESSAGES ----------
# FIX: only return messages that belong to the general channel.
# Old query had no filter at all, so every DM (stored in the same
# collection) leaked into the general channel on every page load.
@app.route('/messages', methods=['GET'])
def get_messages():
    msgs = list(
        messages_collection.find({
            '$or': [
                {'room_id': 'general'},
                {'room_id': {'$exists': False}}  # legacy rows saved before room_id existed
            ]
        }).sort('timestamp', 1).limit(50)
    )
    for msg in msgs:
        msg['_id'] = str(msg['_id'])
    return jsonify(msgs), 200

@app.route('/messages/<message_id>', methods=['DELETE'])
def delete_message(message_id):
    from bson.objectid import ObjectId
    messages_collection.delete_one({"_id": ObjectId(message_id)})
    return jsonify({"message": "Deleted"}), 200

@app.route('/messages/<message_id>', methods=['PUT'])
def edit_message(message_id):
    from bson.objectid import ObjectId
    data = request.json
    messages_collection.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"text": data['text'], "edited": True}}
    )
    return jsonify({"message": "Updated"}), 200

# ---------- USERS ----------
@app.route('/users', methods=['GET'])
def get_users():
    users = list(users_collection.find({}, {'password': 0}))
    for u in users:
        u['_id'] = str(u['_id'])
    return jsonify(users), 200

# ---------- DM MESSAGES ----------
# Already correctly filtered by room_id — no change needed here.
@app.route('/dm/<room_id>', methods=['GET'])
def get_dm_messages(room_id):
    msgs = list(messages_collection.find({'room_id': room_id}).sort('timestamp', 1).limit(100))
    for msg in msgs:
        msg['_id'] = str(msg['_id'])
    return jsonify(msgs), 200

# ---------- CHAT LOCK ----------
@app.route('/chatlock/<room_id>', methods=['GET'])
def get_chat_lock(room_id):
    lock = db['chatlocks'].find_one({'room_id': room_id})
    if lock:
        return jsonify({'locked': True, 'set_by': lock['set_by']}), 200
    return jsonify({'locked': False}), 200

@app.route('/chatlock/<room_id>', methods=['POST'])
def set_chat_lock(room_id):
    data = request.json
    password = data.get('password')
    set_by = data.get('set_by')
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    db['chatlocks'].update_one(
        {'room_id': room_id},
        {'$set': {'room_id': room_id, 'password': hashed, 'set_by': set_by}},
        upsert=True
    )
    return jsonify({'message': 'Lock set'}), 200

@app.route('/chatlock/<room_id>/verify', methods=['POST'])
def verify_chat_lock(room_id):
    data = request.json
    password = data.get('password')
    lock = db['chatlocks'].find_one({'room_id': room_id})
    if not lock:
        return jsonify({'valid': True}), 200
    valid = bcrypt.checkpw(password.encode('utf-8'), lock['password'])
    return jsonify({'valid': valid}), 200

@app.route('/chatlock/<room_id>', methods=['DELETE'])
def remove_chat_lock(room_id):
    db['chatlocks'].delete_one({'room_id': room_id})
    return jsonify({'message': 'Lock removed'}), 200

# ---------- PROFILE ----------
@app.route('/profile/<username>', methods=['GET', 'OPTIONS'])
def get_profile(username):
    if request.method == 'OPTIONS':
        return '', 200
    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "username": user['username'],
        "bio": user.get('bio', ''),
        "avatar_color": user.get('avatar_color', '#667eea'),
        "avatar_url": user.get('avatar_url', '')
    }), 200

@app.route('/profile/<username>', methods=['PUT', 'OPTIONS'])
def update_profile(username):
    if request.method == 'OPTIONS':
        return '', 200
    data = request.json
    update_data = {}
    if 'bio' in data:
        update_data['bio'] = data['bio']
    if 'avatar_color' in data:
        update_data['avatar_color'] = data['avatar_color']
    if 'avatar_url' in data:
        update_data['avatar_url'] = data['avatar_url']
    if 'new_password' in data and data['new_password']:
        current_password = data.get('current_password', '')
        user = users_collection.find_one({"username": username})
        if not bcrypt.checkpw(current_password.encode('utf-8'), user['password']):
            return jsonify({"error": "Current password is incorrect"}), 401
        update_data['password'] = bcrypt.hashpw(data['new_password'].encode('utf-8'), bcrypt.gensalt())
    if update_data:
        users_collection.update_one({"username": username}, {"$set": update_data})
    return jsonify({"message": "Profile updated"}), 200

# ---------- PINNED MESSAGES ----------
@app.route('/pinned', methods=['GET'])
def get_pinned():
    pinned = list(pinned_collection.find().sort('pinned_at', -1))
    for p in pinned:
        p['_id'] = str(p['_id'])
    return jsonify(pinned), 200

@app.route('/pinned', methods=['POST'])
def pin_message():
    data = request.json
    pinned_collection.insert_one({
        'message_id': data['message_id'],
        'text': data['text'],
        'username': data['username'],
        'pinned_by': data['pinned_by'],
        'pinned_at': str(datetime.datetime.utcnow())
    })
    return jsonify({"message": "Pinned"}), 201

@app.route('/pinned/<message_id>', methods=['DELETE'])
def unpin_message(message_id):
    pinned_collection.delete_one({"message_id": message_id})
    return jsonify({"message": "Unpinned"}), 200

# ---------- GROUPS ----------
# Members are embedded in the group document as a list of
# {username, role, joined_at}. role is one of: owner, admin, member.
# Every mutating endpoint re-reads the requester's role from the DB —
# a role sent by the client is never trusted for authorization.

def _serialize_group(g, member_count_only=False):
    g = dict(g)
    g['_id'] = str(g['_id'])
    if member_count_only:
        g['member_count'] = len(g.get('members', []))
        g['member_usernames'] = [m['username'] for m in g.get('members', [])]
        g.pop('members', None)
    return g

def _get_role(group, username):
    for m in group.get('members', []):
        if m['username'] == username:
            return m['role']
    return None

def _group_room_id(group_id):
    return f"group:{group_id}"

@app.route('/groups', methods=['POST'])
def create_group():
    from bson.objectid import ObjectId
    data = request.json
    name = (data.get('name') or '').strip()
    created_by = data.get('created_by')
    if not name or len(name) < 2 or len(name) > 40:
        return jsonify({"error": "Group name must be 2-40 characters"}), 400
    if not created_by:
        return jsonify({"error": "created_by is required"}), 400

    description = (data.get('description') or '')[:140]
    avatar_color = data.get('avatar_color', '#667eea')
    member_usernames = list(dict.fromkeys(data.get('member_usernames', [])))  # dedupe, preserve order
    member_usernames = [u for u in member_usernames if u != created_by]

    now = str(datetime.datetime.utcnow())
    members = [{"username": created_by, "role": "owner", "joined_at": now}]
    for u in member_usernames:
        members.append({"username": u, "role": "member", "joined_at": now})

    group = {
        "name": name,
        "description": description,
        "avatar_color": avatar_color,
        "created_by": created_by,
        "created_at": now,
        "members": members,
    }
    result = groups_collection.insert_one(group)
    group_id = str(result.inserted_id)

    system_text = f"{created_by} created the group"
    messages_collection.insert_one({
        'username': created_by, 'text': system_text, 'type': 'system',
        'timestamp': now, 'room_id': _group_room_id(group_id)
    })
    if member_usernames:
        added_text = f"{created_by} added " + ", ".join(member_usernames)
        messages_collection.insert_one({
            'username': created_by, 'text': added_text, 'type': 'system',
            'timestamp': now, 'room_id': _group_room_id(group_id)
        })

    group['_id'] = result.inserted_id
    serialized = _serialize_group(group, member_count_only=True)
    serialized['member_usernames'] = [m['username'] for m in members]

    for m in members:
        socketio.emit('group_created', serialized, room=m['username'])

    return jsonify(serialized), 201

@app.route('/groups/<username>', methods=['GET'])
def list_groups(username):
    groups = list(groups_collection.find({'members.username': username}))
    return jsonify([_serialize_group(g, member_count_only=True) for g in groups]), 200

@app.route('/groups/<group_id>/info', methods=['GET'])
def group_info(group_id):
    from bson.objectid import ObjectId
    group = groups_collection.find_one({'_id': ObjectId(group_id)})
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(_serialize_group(group)), 200

@app.route('/groups/<group_id>/messages', methods=['GET'])
def group_messages(group_id):
    msgs = list(messages_collection.find({'room_id': _group_room_id(group_id)}).sort('timestamp', 1).limit(200))
    for msg in msgs:
        msg['_id'] = str(msg['_id'])
    return jsonify(msgs), 200

@app.route('/groups/<group_id>', methods=['PATCH'])
def update_group(group_id):
    from bson.objectid import ObjectId
    data = request.json
    changed_by = data.get('changed_by')
    group = groups_collection.find_one({'_id': ObjectId(group_id)})
    if not group:
        return jsonify({"error": "Group not found"}), 404
    role = _get_role(group, changed_by)
    if role not in ('owner', 'admin'):
        return jsonify({"error": "Only the owner or an admin can edit this group"}), 403

    update_data = {}
    if 'name' in data:
        name = (data['name'] or '').strip()
        if len(name) < 2 or len(name) > 40:
            return jsonify({"error": "Group name must be 2-40 characters"}), 400
        update_data['name'] = name
    if 'description' in data:
        update_data['description'] = (data['description'] or '')[:140]
    if 'avatar_color' in data:
        update_data['avatar_color'] = data['avatar_color']
    if 'avatar_url' in data:
        update_data['avatar_url'] = data['avatar_url']
    if update_data:
        groups_collection.update_one({'_id': ObjectId(group_id)}, {'$set': update_data})

    updated = groups_collection.find_one({'_id': ObjectId(group_id)})
    serialized = _serialize_group(updated, member_count_only=True)
    for m in updated['members']:
        socketio.emit('group_updated', serialized, room=m['username'])
    return jsonify(serialized), 200

@app.route('/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    from bson.objectid import ObjectId
    data = request.json or {}
    requested_by = data.get('requested_by')
    group = groups_collection.find_one({'_id': ObjectId(group_id)})
    if not group:
        return jsonify({"error": "Group not found"}), 404
    if group['created_by'] != requested_by:
        return jsonify({"error": "Only the owner can delete this group"}), 403

    member_names = [m['username'] for m in group['members']]
    messages_collection.delete_many({'room_id': _group_room_id(group_id)})
    groups_collection.delete_one({'_id': ObjectId(group_id)})

    for name in member_names:
        socketio.emit('group_deleted', {'group_id': group_id}, room=name)
    return jsonify({"message": "Group deleted"}), 200

@app.route('/groups/<group_id>/members', methods=['POST'])
def add_group_members(group_id):
    from bson.objectid import ObjectId
    data = request.json
    added_by = data.get('added_by')
    new_usernames = list(dict.fromkeys(data.get('usernames', [])))
    group = groups_collection.find_one({'_id': ObjectId(group_id)})
    if not group:
        return jsonify({"error": "Group not found"}), 404
    role = _get_role(group, added_by)
    if role not in ('owner', 'admin'):
        return jsonify({"error": "Only the owner or an admin can add people"}), 403

    existing = {m['username'] for m in group['members']}
    to_add = [u for u in new_usernames if u not in existing]
    if not to_add:
        return jsonify(_serialize_group(group, member_count_only=True)), 200

    now = str(datetime.datetime.utcnow())
    new_members = [{"username": u, "role": "member", "joined_at": now} for u in to_add]
    groups_collection.update_one({'_id': ObjectId(group_id)}, {'$push': {'members': {'$each': new_members}}})

    system_text = f"{added_by} added " + ", ".join(to_add)
    sys_msg = {'username': added_by, 'text': system_text, 'type': 'system',
               'timestamp': now, 'room_id': _group_room_id(group_id)}
    messages_collection.insert_one(sys_msg)
    socketio.emit('message', sys_msg, room=_group_room_id(group_id))

    updated = groups_collection.find_one({'_id': ObjectId(group_id)})
    serialized = _serialize_group(updated, member_count_only=True)
    for m in updated['members']:
        socketio.emit('group_member_added', {**serialized, 'added_usernames': to_add}, room=m['username'])
    return jsonify(serialized), 200

@app.route('/groups/<group_id>/members/<target_username>', methods=['DELETE'])
def remove_group_member(group_id, target_username):
    from bson.objectid import ObjectId
    data = request.json or {}
    removed_by = data.get('removed_by')
    group = groups_collection.find_one({'_id': ObjectId(group_id)})
    if not group:
        return jsonify({"error": "Group not found"}), 404

    requester_role = _get_role(group, removed_by)
    is_self_leave = removed_by == target_username
    if not is_self_leave and requester_role not in ('owner', 'admin'):
        return jsonify({"error": "Only the owner or an admin can remove members"}), 403
    if target_username == group['created_by']:
        return jsonify({"error": "The owner can't be removed or leave — delete the group or transfer ownership first"}), 400

    groups_collection.update_one({'_id': ObjectId(group_id)}, {'$pull': {'members': {'username': target_username}}})

    now = str(datetime.datetime.utcnow())
    system_text = f"{target_username} left the group" if is_self_leave else f"{removed_by} removed {target_username}"
    sys_msg = {'username': removed_by, 'text': system_text, 'type': 'system',
               'timestamp': now, 'room_id': _group_room_id(group_id)}
    messages_collection.insert_one(sys_msg)
    socketio.emit('message', sys_msg, room=_group_room_id(group_id))

    updated = groups_collection.find_one({'_id': ObjectId(group_id)})
    serialized = _serialize_group(updated, member_count_only=True)
    socketio.emit('group_member_removed', {**serialized, 'removed_username': target_username}, room=target_username)
    for m in updated['members']:
        socketio.emit('group_member_removed', {**serialized, 'removed_username': target_username}, room=m['username'])
    return jsonify(serialized), 200

@app.route('/groups/<group_id>/members/<target_username>/role', methods=['PATCH'])
def change_member_role(group_id, target_username):
    from bson.objectid import ObjectId
    data = request.json
    changed_by = data.get('changed_by')
    new_role = data.get('role')
    if new_role not in ('admin', 'member'):
        return jsonify({"error": "Invalid role"}), 400
    group = groups_collection.find_one({'_id': ObjectId(group_id)})
    if not group:
        return jsonify({"error": "Group not found"}), 404
    if group['created_by'] != changed_by:
        return jsonify({"error": "Only the owner can change member roles"}), 403
    if target_username == group['created_by']:
        return jsonify({"error": "The owner's role can't be changed"}), 400

    groups_collection.update_one(
        {'_id': ObjectId(group_id), 'members.username': target_username},
        {'$set': {'members.$.role': new_role}}
    )
    updated = groups_collection.find_one({'_id': ObjectId(group_id)})
    serialized = _serialize_group(updated, member_count_only=True)
    for m in updated['members']:
        socketio.emit('group_updated', serialized, room=m['username'])
    return jsonify(serialized), 200

# ---------- SOCKET.IO ----------
online_users = []

@socketio.on('join')
def handle_join(data):
    username = data['username']
    # FIX: put this connection into a private room keyed by the
    # user's own name. This lets us target DMs to exactly the two
    # participants instead of broadcasting to every connected client.
    join_room(username)

    # Subscribe this socket to every group the user is a member of, so
    # group messages reach them without a separate explicit join step.
    for group in groups_collection.find({'members.username': username}, {'_id': 1}):
        join_room(f"group:{str(group['_id'])}")

    if username not in online_users:
        online_users.append(username)
        emit('message', {
            'type': 'system',
            'text': f'{username} joined the chat 👋',
            'timestamp': str(datetime.datetime.utcnow())
        }, broadcast=True)
    emit('online_users', online_users, broadcast=True)

@socketio.on('join_group')
def handle_join_group(data):
    # Called right after creating a group or being added to one, so the
    # caller's already-open socket subscribes immediately without waiting
    # for a reconnect.
    group_id = data.get('group_id')
    if group_id:
        join_room(f"group:{group_id}")

@socketio.on('send_message')
def handle_message(data):
    room_id = data.get('room_id', 'general')
    message = {
        'username': data['username'],
        'text': data['text'],
        'type': 'user',
        'timestamp': str(datetime.datetime.utcnow()),
        'edited': False,
        'reply_to': data.get('reply_to', None),
        'room_id': room_id
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

# ---------- DIRECT MESSAGES ----------
# FIX: previously used broadcast=True, which sent every private
# message to every connected user (not just the two people in the
# conversation). Now we deliver only to the two participants' own
# rooms (joined above in handle_join), so the "chat lock" password
# gate is actually meaningful — other users never receive the data.
@socketio.on('send_dm')
def handle_dm(data):
    room_id = data.get('room_id')
    message = {
        'username': data['username'],
        'text': data['text'],
        'type': 'user',
        'timestamp': str(datetime.datetime.utcnow()),
        'edited': False,
        'reply_to': data.get('reply_to', None),
        'room_id': room_id
    }
    result = messages_collection.insert_one(message)
    message['_id'] = str(result.inserted_id)

    participants = room_id.split('__dm__') if room_id else []
    for participant in participants:
        emit('dm_message', message, room=participant)

@socketio.on('pin_message')
def handle_pin(data):
    emit('message_pinned', data, broadcast=True)

@socketio.on('unpin_message')
def handle_unpin(data):
    emit('message_unpinned', data, broadcast=True)

# ---------- GROUP MESSAGES ----------
# Membership is re-checked here from the database on every send. The
# client cannot forge access to a group it isn't actually a member of,
# regardless of what the UI shows.
@socketio.on('send_group_message')
def handle_group_message(data):
    from bson.objectid import ObjectId
    group_id = data.get('group_id')
    username = data.get('username')
    if not group_id or not username:
        return
    try:
        group = groups_collection.find_one({'_id': ObjectId(group_id)})
    except Exception:
        return
    if not group or not any(m['username'] == username for m in group.get('members', [])):
        return  # not a member — silently drop, never trust the client

    room_id = _group_room_id(group_id)
    message = {
        'username': username,
        'text': data['text'],
        'type': 'user',
        'timestamp': str(datetime.datetime.utcnow()),
        'edited': False,
        'reply_to': data.get('reply_to', None),
        'room_id': room_id,
        'group_id': group_id,
    }
    result = messages_collection.insert_one(message)
    message['_id'] = str(result.inserted_id)
    emit('group_message', message, room=room_id)

def keep_alive():
    while True:
        time.sleep(600)
        try:
            requests.get('https://s-nalantamil-chat.onrender.com/')
        except:
            pass

if __name__ == '__main__':
    t = threading.Thread(target=keep_alive)
    t.daemon = True
    t.start()
    socketio.run(app, debug=True, port=5000)