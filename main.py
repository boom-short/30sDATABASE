import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# আপনার API Key
API_KEY = "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"
API_URL = "https://openrouter.ai/api/v1/chat/completions"

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
    
    payload = {
        "model": "google/gemini-flash-1.5",
        "messages": [
            {"role": "system", "content": "তুমি একজন দক্ষ পার্সোনাল এআই অ্যাসিস্ট্যান্ট 'আকাশ'। তুমি লটারি প্রেডিকশন এবং মার্কেট মুভমেন্ট বুঝতে সাহায্য করো। সবসময় বাংলায় উত্তর দাও।"},
            {"role": "user", "content": user_message}
        ]
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        ai_reply = response.json()['choices'][0]['message']['content']
        return jsonify({"reply": ai_reply})
    except Exception as e:
        return jsonify({"reply": "দুঃখিত, এআই এখন সংযোগ করতে পারছে না।"})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080)
  
