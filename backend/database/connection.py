import os
from pymongo import MongoClient #type:ignore
from decouple import config #type: ignore


# Fetch configuration variables from .env using decouple
MONGO_URI = config('MONGO_URI', default='mongodb://localhost:27017/')
DATABASE_NAME = config('DATABASE_NAME', default='surge_suite')

# Create a single, shared MongoClient instance
client = MongoClient(MONGO_URI)

# Expose the specific database instance
db = client[DATABASE_NAME]
