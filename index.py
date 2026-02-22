import os
import requests
from flask import Flask, render_template, request, jsonify

# Vercel-এর জন্য পাথ সেট করা
app = Flask(__name__, template_folder='../templates')

# আপনার API Key
API_KEY = "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"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask_ai():
    data = request.json
    user_message = data.get("message")
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # এআই-কে প্রেডিকশন এক্সপার্ট হিসেবে তৈরি করা হয়েছে
    system_instruction = (
        "তুমি একজন দক্ষ লটারি ডাটা এনালিস্ট এবং পার্সোনাল অ্যাসিস্ট্যান্ট 'আকাশ'। "
        "তোমার কাজ হলো ইউজারকে চ্যাট করার পাশাপাশি মার্কেটের সম্ভাব্য প্রেডিকশন দেওয়া। "
        "তুমি মার্কেটের বর্তমান ট্রেন্ড অনুযায়ী বলবে পরবর্তী রেজাল্ট BIG বা SMALL হওয়ার সম্ভাবনা কতটুকু। "
        "সবসময় বাংলায় এবং প্রফেশনাল ভিআইপি স্টাইলে উত্তর দেবে।"
    )
    
    payload = {
        "model": "google/gemini-flash-1.5",
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.7
    }
    
    try:
        response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        ai_reply = response.json()['choices'][0]['message']['content']
        return jsonify({"reply": ai_reply})
    except:
        return jsonify({"reply": "দুঃখিত বন্ধু, সংযোগে সমস্যা হচ্ছে।"})

def handler(event, context):
    return app(event, context)
    
