import os
import json
import pymongo
from datetime import datetime
import uuid
from decouple import config as env_config
from . import config

class FaceDatabase:
    def __init__(self):
        self.use_json_fallback = False
        # Place JSON files in a subdirectory of services called config.JSON_DATABASE
        self.json_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), config.JSON_DATABASE)
        
        try:
            print("Connecting to MongoDB...")
            mongo_uri = env_config('MONGO_URI', default='mongodb://localhost:27017/')
            db_name = env_config('DATABASE_NAME', default='surge_suite')
            
            # Try to connect with a short timeout (1500ms) to avoid long hangs if MongoDB is down
            self.client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=1500)
            self.client.server_info()  # Force connection verification
            self.db = self.client[db_name]
            self.collection = self.db[config.JSON_DATABASE]
            print("Connected to MongoDB successfully.")
        except Exception as err:
            print(f"MongoDB connection failed: {err}")
            print(f"Falling back to local JSON database directory: {self.json_dir}")
            self.use_json_fallback = True
            if not os.path.exists(self.json_dir):
                os.makedirs(self.json_dir)
                
    def load_faces(self):
        """Loads and returns all registered faces: list of dicts matching the metadata format"""
        if self.use_json_fallback:
            faces = []
            try:
                if os.path.exists(self.json_dir):
                    for filename in os.listdir(self.json_dir):
                        if filename.endswith('.json'):
                            path = os.path.join(self.json_dir, filename)
                            try:
                                with open(path, 'r') as f:
                                    faces.append(json.load(f))
                            except Exception as fe:
                                print(f"Error reading JSON file {path}: {fe}")
                return faces
            except Exception as e:
                print(f"Error reading JSON database: {e}")
                return []
        else:
            try:
                faces = []
                for doc in self.collection.find():
                    # Remove the internal MongoDB ObjectId so it's JSON serializable
                    doc.pop('_id', None)
                    faces.append(doc)
                return faces
            except Exception as e:
                print(f"Error reading from MongoDB: {e}")
                return []
                
    def add_face(self, name, embedding, user_id=None, device_id=None, extra_metadata=None):
        """Saves a new face name, embedding, and metadata to the active database"""
        now_str = datetime.utcnow().isoformat() + "Z"
        face_data = {
            'user_id': user_id or uuid.uuid4().hex,
            'name': name,
            'embedding': list(embedding),
            'created_at': now_str,
            'last_login': now_str,
            'device_id': device_id or 'unknown_device',
            'active': True
        }
        if extra_metadata:
            face_data.update(extra_metadata)
            
        if self.use_json_fallback:
            try:
                file_path = os.path.join(self.json_dir, f"user_{face_data['user_id']}.json")
                with open(file_path, 'w') as f:
                    json.dump(face_data, f, indent=4)
                print(f"Successfully registered '{name}' in local JSON file: {file_path}")
                return face_data
            except Exception as e:
                print(f"Failed to save to local JSON: {e}")
                return None
        else:
            try:
                self.collection.insert_one(face_data.copy())
                print(f"Successfully registered '{name}' in MongoDB.")
                return face_data
            except Exception as e:
                print(f"Failed to save to MongoDB: {e}")
                return None

    def update_last_login(self, user_id):
        """Updates the last_login timestamp for a user"""
        now_str = datetime.utcnow().isoformat() + "Z"
        if self.use_json_fallback:
            try:
                file_path = os.path.join(self.json_dir, f"user_{user_id}.json")
                if os.path.exists(file_path):
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                    data['last_login'] = now_str
                    with open(file_path, 'w') as f:
                        json.dump(data, f, indent=4)
                    return True
                return False
            except Exception as e:
                print(f"Failed to update login time in local JSON: {e}")
                return False
        else:
            try:
                self.collection.update_one({'user_id': user_id}, {'$set': {'last_login': now_str}})
                return True
            except Exception as e:
                print(f"Failed to update login time in MongoDB: {e}")
                return False
