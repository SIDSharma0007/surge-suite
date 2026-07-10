from database.connection import client, db

try:
    client.admin.command('ping')
    print('MongoDB connected successfully.')
except Exception as e:
    print('MongoDB connection failed:', e)

db.test.insert_one({
    "status": "connected"
})
print("Document inserted successfully.")