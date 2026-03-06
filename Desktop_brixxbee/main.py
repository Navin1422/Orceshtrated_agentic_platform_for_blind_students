import cv2
import base64
import speech_recognition as sr
import webbrowser
import os
import time
import threading
import queue
import customtkinter as ctk
import requests
from PIL import Image
from openai import OpenAI
try:
    from dotenv import load_dotenv
    # Explicitly load from the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        print(f"WARNING: .env file not found at {env_path}")
except ImportError:
    print("WARNING: python-dotenv not installed. Environment variables must be set manually.")

# --- CONFIGURATION ---
# Load from .env with fallbacks
VISION_API_KEY = os.getenv("VISION_API_KEY")
VISION_MODEL = os.getenv("VISION_MODEL") or "google/gemini-2.0-flash-001" 

BRAIN_API_KEY = os.getenv("BRAIN_API_KEY")
BRAIN_MODEL = os.getenv("BRAIN_MODEL") or "google/gemini-2.0-flash-001"

# Validate keys
if not VISION_API_KEY or not BRAIN_API_KEY:
    print("ERROR: API keys not found! Please check your .env file.")
    print(f"VISION_API_KEY: {'[SET]' if VISION_API_KEY else '[MISSING]'}")
    print(f"BRAIN_API_KEY: {'[SET]' if BRAIN_API_KEY else '[MISSING]'}")
    # We'll allow it to continue to the traceback for now, or we could exit.
    # But let's keep it informative.

# Setup OpenRouter clients with headers
headers = {
    "HTTP-Referer": "http://localhost:5174",
    "X-Title": "Brixbee AI Guardian",
}

# Clients
try:
    v_client = OpenAI(
        base_url="https://openrouter.ai/api/v1", 
        api_key=VISION_API_KEY or "missing_key",
        default_headers=headers
    )
    b_client = OpenAI(
        base_url="https://openrouter.ai/api/v1", 
        api_key=BRAIN_API_KEY or "missing_key",
        default_headers=headers
    )
except Exception as e:
    print(f"Init Error: {e}")


# Project Config
WEBSITE_URL           = "http://localhost:3000/"
AUTO_LOGIN_URL        = "http://localhost:3000/auto-login?name=BrixbeeStudent&role=student"
BACKEND_BASE_URL      = "http://localhost:5001"
PDF_CHAT_API_URL      = f"{BACKEND_BASE_URL}/api/ai/pdf-chat"  # Legacy fallback
BRIXBEE_AGENT_URL     = f"{BACKEND_BASE_URL}/api/ai/brixbee-chat"  # LangGraph Agent
WAKE_WORDS = ["hey brixbee", "hey bricks b", "hey bixby", "hey brix", "brixbee", "brix", "bixby"]

# Subject keywords that trigger PDF Q&A
SUBJECT_KEYWORDS = [
    "math", "maths", "mathematics", "algebra", "geometry", "arithmetic",
    "science", "physics", "chemistry", "biology",
    "english", "grammar", "vocabulary", "poem", "prose",
    "social", "history", "geography", "civics",
    "explain", "what is", "define", "chapter", "lesson", "textbook",
    "teach me", "tell me about", "how does", "why is", "who is", "where is",
    "solve", "calculate", "equation"
]

# Website open keywords → use auto-login URL
WEBSITE_OPEN_KEYWORDS = [
    "ai website", "learning platform", "ai platform", "eduvoice",
    "brixbee website", "learning website", "my website", "student dashboard",
    "open website", "study platform"
]

# --- APP SETUP ---
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class BrixbeeApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Brixbee - AI Teacher for Blind Children")
        self.geometry("450x650")
        self.configure(fg_color="#0F0F0B") # Black-gold aesthetic
        
        # Audio System (Earcons)
        # Using native macOS 'afplay' instead of pygame to avoid SDL conflicts
        self.sounds = {
            "vision": "/System/Library/Sounds/Ping.aiff",
            "thinking": "/System/Library/Sounds/Tink.aiff",
            "alert": "/System/Library/Sounds/Sosumi.aiff",
            "active": "/System/Library/Sounds/Glass.aiff"
        }
        
        # Screen Geometry
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width // 2) - (450 // 2)
        y = (screen_height // 2) - (650 // 2)
        self.geometry(f"450x720+{x}+{y}")
        
        self.grid_columnconfigure(0, weight=1)

        # Main Logo
        try:
            logo_img = ctk.CTkImage(light_image=Image.open(os.path.join(script_dir, "brixbee.png")),
                                    dark_image=Image.open(os.path.join(script_dir, "brixbee.png")),
                                    size=(120, 120))
            self.logo_label = ctk.CTkLabel(self, image=logo_img, text="")
            self.logo_label.grid(row=0, column=0, pady=(40, 0))
        except:
            self.logo_label = ctk.CTkLabel(self, text="🐝", font=ctk.CTkFont(size=60))
            self.logo_label.grid(row=0, column=0, pady=(40, 0))

        self.title_label = ctk.CTkLabel(self, text="EduVoice Brixbee", font=ctk.CTkFont(size=32, weight="bold"))
        self.title_label.grid(row=1, column=0, pady=(10, 0))
        
        self.subtitle_label = ctk.CTkLabel(self, text="PREMIUM AI COMPANION", text_color="#D4AF37", font=ctk.CTkFont(size=12, weight="bold"))
        self.subtitle_label.grid(row=2, column=0, pady=(2, 30))

        # Status Circle
        self.status_circle = ctk.CTkFrame(self, width=220, height=220, corner_radius=110, fg_color="#121212", border_width=2, border_color="#D4AF37")
        self.status_circle.grid(row=3, column=0, pady=10)
        self.status_circle.grid_propagate(False)
        self.status_circle.grid_columnconfigure(0, weight=1)
        self.status_circle.grid_rowconfigure(0, weight=1)

        self.status_label = ctk.CTkLabel(self.status_circle, text="IDLE", font=ctk.CTkFont(size=20, weight="bold"))
        self.status_label.grid(row=0, column=0)

        # Log Window
        self.log_text = ctk.CTkTextbox(self, width=380, height=100, corner_radius=15, border_width=1, border_color="#333333", bg_color="transparent", fg_color="#161616")
        self.log_text.grid(row=4, column=0, pady=(20, 5), padx=20)
        self.log_text.configure(state="disabled")

        # Chat Input
        self.chat_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.chat_frame.grid(row=5, column=0, pady=(10, 20), padx=20, sticky="ew")
        self.chat_frame.grid_columnconfigure(0, weight=1)

        self.chat_entry = ctk.CTkEntry(self.chat_frame, placeholder_text="Type to Brixbee...", height=45, corner_radius=20, border_color="#333333", fg_color="#161616")
        self.chat_entry.grid(row=0, column=0, padx=(0, 10), sticky="ew")
        self.chat_entry.bind("<Return>", lambda e: self.send_chat())

        self.send_button = ctk.CTkButton(self.chat_frame, text="▲", width=45, height=45, corner_radius=22, fg_color="#D4AF37", hover_color="#B8860B", text_color="#000000", font=ctk.CTkFont(size=20), command=self.send_chat)
        self.send_button.grid(row=0, column=1)

        # Config Attributes
        self.guard_mode = False
        self.last_guard_check = 0
        self.pulse_val = 0
        self.pulse_dir = 1
        self.animate_pulse()
        self.memory = []          # Legacy memory (for native AI fallback only)
        self.agent_history = []   # LangGraph agent conversation history
        self.student_name = "BrixbeeStudent"  # Will be resolved by LangGraph agent
        self.conversation_active = False
        self.last_interaction_time = 0
        self.tamil_mode = False
        self.current_state = "IDLE"

        # Control Panel
        self.control_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.control_frame.grid(row=6, column=0, pady=20, padx=40, sticky="ew")
        self.control_frame.grid_columnconfigure((0,1), weight=1)

        self.guard_btn = ctk.CTkButton(self.control_frame, text="🛡️ Guardian: Off", font=ctk.CTkFont(weight="bold"), 
                                      fg_color="#1a1a1a", border_width=1, border_color="#D4AF37", 
                                      hover_color="#333333", command=self.toggle_guard)
        self.guard_btn.grid(row=0, column=0, padx=5, sticky="ew")

        self.lang_btn = ctk.CTkButton(self.control_frame, text="🇮🇳 Tamil: Off", font=ctk.CTkFont(weight="bold"), 
                                      fg_color="#1a1a1a", border_width=1, border_color="#D4AF37", 
                                      hover_color="#333333", command=self.toggle_lang)
        self.lang_btn.grid(row=0, column=1, padx=5, sticky="ew")



        # Speech Queue (Thread safety for TTS)
        self.speech_queue = queue.Queue()
        self.speech_thread = threading.Thread(target=self.speech_worker, daemon=True)
        self.speech_thread.start()

        # Camera Feed System (Will be initialized on demand)
        self.cap = None
        self.camera_zoomed = False
        
        # Camera Preview Frame (Hidden by default)
        self.camera_container = ctk.CTkFrame(self, width=120, height=90, corner_radius=10, border_width=2, border_color="#D4AF37")
        self.camera_container.bind("<Button-1>", lambda e: self.toggle_camera_zoom())
        
        self.camera_label = ctk.CTkLabel(self.camera_container, text="")
        self.camera_label.grid(row=0, column=0)
        self.camera_label.bind("<Button-1>", lambda e: self.toggle_camera_zoom())

        # Start logic
        self.thread = threading.Thread(target=self.run_logic, daemon=True)
        self.thread.start()
        
        # Start Guardian Thread
        self.guard_thread = threading.Thread(target=self.guard_loop, daemon=True)
        self.guard_thread.start()

        # Start Camera Feed loop
        self.update_camera_feed()

    def toggle_camera_zoom(self):
        """Toggles the camera between small corner view and large center view."""
        self.camera_zoomed = not self.camera_zoomed
        if self.camera_zoomed:
            # Zoomed: Large center view, hides status circle
            self.camera_container.configure(width=400, height=300)
            self.camera_container.place(x=25, y=100)
            self.status_circle.grid_remove()
        else:
            # Normal: Corner view
            self.camera_container.configure(width=120, height=90)
            self.camera_container.place(x=310, y=20)
            self.status_circle.grid()

    def toggle_guard(self):
        self.guard_mode = not self.guard_mode
        if self.guard_mode:
            self.guard_btn.configure(text="🛡️ Guardian: ON", fg_color="#4F3601", border_color="#F1C40F")
            self.speak("Guardian mode activated. I am watching over you.")
        else:
            self.guard_btn.configure(text="🛡️ Guardian: Off", fg_color="#1a1a1a", border_color="#D4AF37")
            self.speak("Guardian mode deactivated.")

    def toggle_lang(self):
        self.tamil_mode = not self.tamil_mode
        if self.tamil_mode:
            self.lang_btn.configure(text="🇮🇳 Tamil: ON", fg_color="#1B4D2D", border_color="#2ECC71")
            self.speak("Tamil mode activated. இனி நான் தமிழில் பேசுவேன்.")
        else:
            self.lang_btn.configure(text="🇮🇳 Tamil: Off", fg_color="#1a1a1a", border_color="#D4AF37")
            self.speak("English mode activated.")



    def update_camera_feed(self):
        """Continuously updates the UI and manages hardware camera state (On/Off)."""
        # Check if camera should be active (Guardian mode OR actively seeing)
        should_be_active = self.guard_mode or (hasattr(self, 'current_state') and self.current_state in ["SEEING"])
        
        if should_be_active:
            # 1. Hardware Management: Turn Camera ON if it's off
            if self.cap is None or not self.cap.isOpened():
                print("DEBUG: Activating camera hardware...")
                self.cap = cv2.VideoCapture(0)
                # Small wait for hardware to warm up
                self.after(500, self.update_camera_feed)
                return

            # 2. UI Visibility Management
            if not self.camera_container.winfo_ismapped():
                if self.camera_zoomed:
                    self.camera_container.place(x=25, y=100)
                    self.status_circle.grid_remove()
                else:
                    self.camera_container.place(x=310, y=20)
            
            # 3. Read Frame
            ret, frame = self.cap.read()
            if ret:
                frame = cv2.flip(frame, 1)
                cv2_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                size = (400, 300) if self.camera_zoomed else (120, 90)
                img = Image.fromarray(cv2_image)
                ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=size)
                self.title_label.lift()
                self.camera_label.configure(image=ctk_img)
                self.camera_label.image = ctk_img
        else:
            # Hardware Management: Turn Camera OFF if it's on
            if self.cap is not None:
                print("DEBUG: Releasing camera hardware...")
                self.cap.release()
                self.cap = None
            
            # UI Visibility Management
            if self.camera_container.winfo_ismapped():
                self.camera_container.place_forget()
                self.status_circle.grid()
        
        # Schedule next update
        self.after(33, self.update_camera_feed)

    def speech_worker(self):
        """Dedicated thread to handle the speech with a native macOS 'say' command for maximum stability."""
        print("DEBUG: Speech worker ready (using native 'say').")
        
        while True:
            text = self.speech_queue.get()
            if text is None: break
            
            # Clean the text for speech (Remove markdown and special characters)
            clean_text = text.replace('*', '').replace('_', '').replace('#', '').replace('"', '').replace("'", "").replace("\n", " ").strip()
            
            if not clean_text:
                self.speech_queue.task_done()
                continue

            self.set_status("SPEAKING", "#2ECC71")
            try:
                # Safely check for tamil_mode which might be on the main app object
                is_tamil = getattr(self, 'tamil_mode', False)
                # Use native macOS 'say' command
                if is_tamil:
                    # 'Lekha' is the standard high-quality Tamil voice on macOS
                    os.system(f'say -v Lekha "{clean_text}" || say "{clean_text}"')
                else:
                    os.system(f'say -v Samantha "{clean_text}" || say "{clean_text}"')
            except Exception as e:
                print(f"DEBUG: Native 'say' failed: {e}")

            self.set_status("IDLE")
            self.speech_queue.task_done()

    def send_chat(self):
        """Processes a text message from the UI chat input."""
        msg = self.chat_entry.get().strip()
        if not msg: return
        
        self.chat_entry.delete(0, "end")
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"You: {msg}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")
        
        # Process in a separate thread so UI doesn't freeze
        def process():
            self.conversation_active = True
            self.last_interaction_time = time.time()
            
            # Simple command routing for chat too
            if any(k in msg.lower() for k in ["guard", "guardian", "safety", "watch me"]):
                if any(x in msg.lower() for x in ["stop", "off", "deactivate"]):
                    self.guard_mode = False
                    self.speak("Safety mode deactivated.")
                else:
                    self.guard_mode = True
                    self.speak("Safety mode activated!")
                return

            ans = self.ask_ai(msg)
            self.speak(ans)
            
        threading.Thread(target=process, daemon=True).start()

    def speak(self, text):
        """Thread-safe speech call that uses the worker queue."""
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"Brixbee: {text}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")
        self.speech_queue.put(text)

    def play_sound(self, name):
        """Plays a macOS system sound as an earcon using native afplay."""
        try:
            if name in self.sounds:
                # Use afplay for native Mac audio (non-blocking)
                os.system(f"afplay {self.sounds[name]} &")
        except:
            pass

    def animate_pulse(self):
        """Creates a smooth breathing animation on the status circle."""
        if hasattr(self, 'current_state') and self.current_state == "LISTENING":
            self.pulse_val += self.pulse_dir * 5
            if self.pulse_val > 100 or self.pulse_val < 0:
                self.pulse_dir *= -1
            self.status_circle.configure(fg_color=f"#0D2E49") 
        self.after(50, self.animate_pulse)

    def set_status(self, text, color="#D4AF37", play_sound=True):
        self.current_state = text.upper()
        self.status_label.configure(text=text.upper())
        self.status_circle.configure(border_color=color)
        
        if play_sound:
            if text.upper() == "LISTENING":
                self.play_sound("active")
                self.status_circle.configure(fg_color="#0D2E49")
            elif text.upper() == "THINKING":
                self.play_sound("thinking")
                self.status_circle.configure(fg_color="#4F3601")
            elif text.upper() == "SPEAKING":
                self.status_circle.configure(fg_color="#1B4D2D")
            elif text.upper() == "SEEING":
                self.play_sound("vision")
                self.status_circle.configure(fg_color="#5D3FD3") # Purple for vision
            else:
                self.status_circle.configure(fg_color="#1a1a1a")
        else:
            # Update visuals only
            if text.upper() == "THINKING": self.status_circle.configure(fg_color="#4F3601")
            elif text.upper() == "SPEAKING": self.status_circle.configure(fg_color="#1B4D2D")
            elif text.upper() == "SEEING": self.status_circle.configure(fg_color="#5D3FD3")
            else: self.status_circle.configure(fg_color="#1a1a1a")

    def guard_loop(self):
        """Background thread: Periodically checks environment for safety/mood."""
        while True:
            if self.guard_mode:
                current_time = time.time()
                # Check every 15 seconds in guard mode
                if current_time - self.last_guard_check > 15:
                    self.last_guard_check = current_time
                    img = self.capture_image()
                    if img:
                        prompt = "You are a Guardian AI. Image scan: 1. Hazards? 2. Emotion? Respond ONLY 'SAFE' if okay. Otherwise, 1 short sentence hazard/mood warning."
                        raw_vision = self.analyze_image(img, prompt)
                        
                        if raw_vision and "SAFE" not in raw_vision.upper():
                            self.play_sound("alert")
                            ans = self.ask_ai(f"I am in Guardian mode and I noticed something: {raw_vision}. Tell the child gently.", vision_data=raw_vision)
                            self.speak(ans)
            time.sleep(2)

    def capture_image(self):
        """Captures a frame from the already open webcam or opens it briefly if needed."""
        self.set_status("SEEING", "#9B59B6")
        
        # If camera isn't already open (e.g. not in Guardian mode), open it
        temp_cap = False
        if self.cap is None or not self.cap.isOpened():
            self.cap = cv2.VideoCapture(0)
            time.sleep(1.0) # Hardware warm up
            temp_cap = True

        ret, frame = self.cap.read()
        
        if not ret:
            # Try once to reconnect
            self.cap.release()
            self.cap = cv2.VideoCapture(0)
            time.sleep(1.0)
            ret, frame = self.cap.read()
            if not ret: 
                self.cap = None
                return None
            
        # Convert to base64
        _, buffer = cv2.imencode('.jpg', frame)
        
        # If we opened it just for this shot, release it
        if temp_cap and not self.guard_mode:
            self.cap.release()
            self.cap = None

        return base64.b64encode(buffer).decode('utf-8')

    def analyze_image(self, image_base64, prompt):
        """Vision Agent (Gemini): Processes pixels and describes them to the Brain."""
        # Only play tingle if not already in thinking state
        self.set_status("THINKING", "#F1C40F", play_sound=(self.current_state != "THINKING"))
        try:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ]
            
            completion = v_client.chat.completions.create(
                model=VISION_MODEL,
                messages=messages,
                max_tokens=300
            )
            return completion.choices[0].message.content
        except Exception as e:
            err_msg = str(e)
            print(f"Vision Agent Error: {err_msg}")
            if "401" in err_msg:
                return "My vision system is unauthorized. Please check the API key."
            return "I am having trouble processing the image."

    def ask_pdf_ai(self, question):
        """Legacy PDF/Subject Teacher - kept as fallback only."""
        self.set_status("THINKING", "#F1C40F", play_sound=(self.current_state != "THINKING"))
        try:
            resp = requests.post(
                PDF_CHAT_API_URL,
                json={"question": question, "subject": question, "studentName": self.student_name},
                timeout=20
            )
            if resp.status_code == 200:
                data = resp.json()
                answer = data.get("answer", "")
                return answer if answer else None
            return None
        except Exception as e:
            print(f"DEBUG: PDF Chat API unreachable: {e}")
            return None

    def ask_langgraph_agent(self, message, interaction_type="assistant", vision_context=None):
        """
        PRIMARY AI method: Routes ALL messages through the LangGraph Brixbee Agent.
        The agent automatically:
          - Fetches the student's profile from the website database
          - Searches textbooks for subject questions
          - Syncs learning progress back to the website
          - Logs the interaction for teacher review
        Falls back to native AI if the backend is unreachable.
        """
        self.set_status("THINKING", "#F1C40F", play_sound=(self.current_state != "THINKING"))

        # Append vision context to message if available
        full_message = message
        if vision_context:
            full_message = f"{message} [Vision context: {vision_context}]"

        # Add to agent history
        self.agent_history.append({"role": "user", "content": full_message})
        if len(self.agent_history) > 8:
            self.agent_history = self.agent_history[-8:]

        try:
            print(f"DEBUG: Calling LangGraph Brixbee Agent... type={interaction_type}")
            resp = requests.post(
                BRIXBEE_AGENT_URL,
                json={
                    "message": full_message,
                    "studentName": self.student_name,
                    "interactionType": interaction_type,
                    "history": self.agent_history[:-1]  # Exclude the message we just added
                },
                timeout=30
            )
            if resp.status_code == 200:
                data = resp.json()
                answer = data.get("answer", "")
                tools_used = data.get("toolsUsed", [])
                if tools_used:
                    print(f"DEBUG: LangGraph tools used: {tools_used}")

                if answer:
                    # Add to agent history
                    self.agent_history.append({"role": "assistant", "content": answer})
                    return answer

            print(f"DEBUG: LangGraph Agent returned status {resp.status_code}")
            return None  # Fall back to native AI

        except Exception as e:
            print(f"DEBUG: LangGraph Agent unreachable: {e}. Falling back to native AI.")
            return None  # Fall back to native AI

    def ask_ai(self, question, model_type="teacher", vision_data=None):
        """Brain Agent: The lead orchestrator (Supports GPT-4o Audio with fallback)."""
        self.set_status("THINKING", "#F1C40F", play_sound=(self.current_state != "THINKING"))
        
        # Add to memory
        if question:
            self.memory.append({"role": "user", "content": question})
        if len(self.memory) > 10: self.memory = self.memory[-10:] 

        try:
            # Multi-Agent Context
            system_context = ""
            if vision_data:
                system_context = f"\n[VISION DATA]: {vision_data}."

            # Set language instructions
            is_tamil = getattr(self, 'tamil_mode', False)
            lang_instruction = "Speak in English."
            if is_tamil:
                lang_instruction = "Speak in TAMIL ONLY. Use simple and warm Tamil language."

            role_prompt = (
                f"You are Brixbee, a friendly AI companion for a blind child. {lang_instruction} "
                "Be very warm, supportive, and natural. Keep responses short (1-2 sentences). "
                "CRITICAL: If the user asks for Safety or Guardian mode, say 'Activating safety mode now.'"
                f"{system_context}"
            )
            
            messages = [{"role": "system", "content": role_prompt}] + self.memory

            # Attempt the call with high robustness
            try:
                print(f"DEBUG: Calling {BRAIN_MODEL}...")
                
                # Check if we are using the audio preview model
                is_audio_model = "audio" in BRAIN_MODEL.lower()
                
                # We'll try to get text back primarily for the local TTS
                extra_params = {}
                if is_audio_model:
                    extra_params = {
                        "modalities": ["text", "audio"],
                        "audio": {"voice": "alloy", "format": "wav"}
                    }

                # We use a non-streaming call first for maximum stability 
                # unless the model strictly forbids it (GPT-4o Audio Preview sometimes does)
                response_text = ""
                
                # Fallback to gpt-4o standard if the audio preview is being difficult
                model_to_use = BRAIN_MODEL
                
                completion = b_client.chat.completions.create(
                    model=model_to_use,
                    messages=messages,
                    max_tokens=300,
                    timeout=25.0,
                    stream=True, # Satisfy the requirement
                    **extra_params
                )
                
                sentence_buffer = ""
                for chunk in completion:
                    if chunk.choices and hasattr(chunk.choices[0], 'delta'):
                        content = chunk.choices[0].delta.content
                        if content:
                            response_text += content
                            sentence_buffer += content
                            
                            # Stream sentence by sentence for speed
                            if any(p in sentence_buffer for p in [". ", "! ", "? ", "\n"]):
                                parts = sentence_buffer.split(". ") if ". " in sentence_buffer else \
                                        sentence_buffer.split("! ") if "! " in sentence_buffer else \
                                        sentence_buffer.split("? ") if "? " in sentence_buffer else \
                                        sentence_buffer.split("\n")
                                
                                to_speak = parts[0].strip()
                                if to_speak:
                                    self.speak(to_speak)
                                sentence_buffer = "".join(parts[1:])

                # Speak remaining
                if sentence_buffer.strip():
                    self.speak(sentence_buffer.strip())
                
            except Exception as inner_e:
                print(f"DEBUG: Primary model failed ({inner_e}). Falling back to gpt-4o standard...")
                completion = b_client.chat.completions.create(
                    model="google/gemini-2.0-flash-001",
                    messages=messages,
                    max_tokens=300,
                    timeout=15.0,
                    stream=False
                )
                response_text = completion.choices[0].message.content
                self.speak(response_text)

            print(f"DEBUG: Brain response processed.")
            
            if not response_text:
                response_text = "I'm listening. Could you repeat that?"

            self.memory.append({"role": "assistant", "content": response_text})

            # Store in DB
            def do_log():
                try:
                    requests.post("http://localhost:5001/api/ai/log", json={
                        "query": question or "Speech",
                        "response": response_text,
                        "type": model_type
                    }, timeout=2) 
                except: pass
            threading.Thread(target=do_log, daemon=True).start()

            return response_text
        except Exception as e:
            err_msg = str(e)
            print(f"Brain Agent Error: {err_msg}")
            if "401" in err_msg:
                return "I am sorry, my brain is not authorized right now. Please check the API key."
            if "429" in err_msg:
                return "I'm a bit overwhelmed right now. My API limit has been reached. Please try again in a few minutes."
            return "I missed that, could you say it again?"

    def get_audio(self, timeout=7):
        r = sr.Recognizer()
        with sr.Microphone() as source:
            r.energy_threshold = 300 # Slightly more sensitive
            try:
                self.set_status("LISTENING", "#3498DB")
                # Reduced duration for faster response (0.5 -> 0.2)
                r.adjust_for_ambient_noise(source, duration=0.2)
                audio = r.listen(source, timeout=timeout, phrase_time_limit=10)
                
                lang_code = 'ta-IN' if getattr(self, 'tamil_mode', False) else 'en-IN'
                print(f"DEBUG: Listening for {lang_code}...")
                query = r.recognize_google(audio, language=lang_code)
                print(f"DEBUG: Recognized: {query}")
                return query.lower()
            except sr.UnknownValueError:
                print("DEBUG: Speech was unintelligible.")
                return ""
            except sr.RequestError as e:
                print(f"DEBUG: Google Speech error: {e}")
                return ""
            except Exception as e:
                print(f"DEBUG: get_audio error: {e}")
                return ""

    def run_logic(self):
        time.sleep(2)
        self.speak("I am ready for a live chat. Just say Hey Brixbee to start.")
        
        while True:
            current_time = time.time()
            
            # If we are in an active conversation, listen without needing the wake word
            if self.conversation_active:
                # If silent for more than 60 seconds, end live mode
                if current_time - self.last_interaction_time > 60:
                    self.conversation_active = False
                    self.speak("I'll go to sleep now. Just say Hey Brixbee if you need me again!")
                    continue

                query = self.get_audio(timeout=12) # Longer listening window for live mode
            else:
                self.set_status("IDLE")
                query = self.get_audio()
            
            if not query: continue

            # Detect wake word
            is_wake = any(w in query for w in WAKE_WORDS)
            
            if is_wake or self.conversation_active:
                print(f"DEBUG: Wake word detected or conversation active (query: {query})")
                self.last_interaction_time = time.time()
                
                # Activate live mode
                if not self.conversation_active:
                    self.conversation_active = True
                
                user_msg = query
                if is_wake:
                    for w in WAKE_WORDS:
                        if user_msg.startswith(w):
                            user_msg = user_msg.replace(w, "", 1).strip()
                            break

                # Handle Goodbye/Exit
                if any(x in user_msg for x in ["goodbye", "stop", "exit", "go to sleep", "shut down"]):
                    self.speak("Goodbye! I will be waiting.")
                    self.conversation_active = False
                    self.memory = []
                    continue

                # Command Routing
                vision_words = ["see", "look", "describe", "read", "color", "what is this", "what am i holding", "vision", "camera"]
                search_words = ["where is", "find my", "locate"]
                
                # 1. Handle Object Search (Multi-Agent Flow)
                if any(k in user_msg for k in search_words):
                    target = user_msg.split("is")[-1].strip() if "is" in user_msg else user_msg.split("my")[-1].strip()
                    self.speak(f"Looking for your {target}. Hold on.")
                    img = self.capture_image()
                    if img:
                        # Agent 1 (Vision) gets raw data
                        prompt = f"Identify the location of the {target} relative to the center. Be brief."
                        raw_vision = self.analyze_image(img, prompt)
                        
                        if raw_vision:
                            # Agent 2 (Brain) creates a warm response for the child
                            ans = self.ask_ai(f"I found the {target}. Tell the child where it is based on this data: {raw_vision}", vision_data=raw_vision)
                            self.speak(ans)
                        else:
                            self.speak(f"I'm sorry, I couldn't find the {target}. Could you move the camera around?")
                        continue
                    else:
                        self.speak("I couldn't access the camera. Please make sure it is connected.")
                        continue

                # 2. Handle General Vision (Multi-Agent Flow)
                if any(k in user_msg for k in vision_words):
                    self.speak("Let me take a look.")
                    img = self.capture_image()
                    if img:
                        v_prompt = "Describe exactly what is in front of the camera."
                        if "read" in user_msg: v_prompt = "Transcribe all text visible in this image."
                        
                        raw_vision = self.analyze_image(img, v_prompt)
                        
                        if raw_vision:
                            # Brain Agent interprets the vision data for the blind student
                            ans = self.ask_ai(f"Explain what I am seeing in simple words. Vision report: {raw_vision}", vision_data=raw_vision)
                            self.speak(ans)
                        else:
                            self.speak("I'm sorry, I couldn't process the image. Please try again.")
                        continue
                    else:
                        self.speak("I couldn't access the camera. Please make sure it is connected.")
                        continue

                # 3. Handle Weather
                if "weather" in user_msg:
                    self.speak("Checking the weather in Tamil Nadu for you.")
                    try:
                        import requests
                        # Simple free weather service (no key needed for basic info)
                        resp = requests.get("https://wttr.in/Tamil%20Nadu?format=3", timeout=3)
                        if resp.status_code == 200:
                            self.speak(f"The weather is {resp.text}")
                        else:
                            self.speak("I couldn't reach the weather service right now.")
                    except:
                        self.speak("I'm unable to check the weather at the moment.")
                    continue

                # 4. Handle Guard/Safety Mode (Enhanced robust matching)
                safety_keywords = ["guard", "guardian", "safety", "watch me", "watch over me", "protection"]
                if any(k in user_msg for k in safety_keywords):
                    if any(x in user_msg for x in ["stop", "off", "deactivate", "disable", "shut down", "go away"]):
                        self.guard_mode = False
                        msg = "Safety mode deactivated. Turning off the camera." if not self.tamil_mode else "பாதுகாப்பு முறை அணைக்கப்பட்டது. கேமரா அணைக்கப்பட்டது."
                        self.speak(msg)
                    else:
                        self.guard_mode = True
                        msg = "Safety mode activated! Turning on the camera to watch over you." if not self.tamil_mode else "பாதுகாப்பு முறை செயல்படுத்தப்பட்டது! நான் உங்களை கவனிக்கிறேன்."
                        self.speak(msg)
                    continue

                # 5. Handle Language Switching
                if "tamil" in user_msg or "தமிழ்" in user_msg:
                    self.tamil_mode = True
                    self.speak("வணக்கம்! நான் இப்போது தமிழில் பேசுவேன். நான் உங்களுக்கு எப்படி உதவட்டும்?")
                    continue
                
                if "english" in user_msg:
                    self.tamil_mode = False
                    self.speak("I will speak in English now. How can I help you?")
                    continue

                if "open" in user_msg:
                    # 1. Check for AI/learning platform keywords → auto-login
                    if any(x in user_msg for x in WEBSITE_OPEN_KEYWORDS):
                        self.speak("Opening your student dashboard and logging you in automatically.")
                        webbrowser.open(AUTO_LOGIN_URL)
                        continue

                    # 2. Check for brixbee website (generic)
                    if any(x in user_msg for x in ["brixbee", "specially", "notes", "project", "website"]):
                        self.speak("Opening EduVoice for you. You will be logged in automatically.")
                        webbrowser.open(AUTO_LOGIN_URL)
                        continue
                    
                    # 3. Check for common sites
                    sites = {
                        "youtube": "https://www.youtube.com",
                        "amazon":  "https://www.amazon.in",
                        "flipkart": "https://www.flipkart.com",
                        "google":  "https://www.google.com",
                        "facebook": "https://www.facebook.com"
                    }
                    
                    handled = False
                    for site_name, url in sites.items():
                        if site_name in user_msg:
                            self.speak(f"Opening {site_name} for you.")
                            webbrowser.open(url)
                            handled = True
                            break
                    if handled: continue
                
                # If just the wake word without a query, wait for them to speak
                if not user_msg:
                    self.speak("Yes? I'm listening.")
                    continue

                # --- LangGraph Brixbee Agent (PRIMARY routing for all questions) ---
                # Determine interaction type for logging
                is_subject_q = any(k in user_msg for k in SUBJECT_KEYWORDS)
                interaction_type = "teacher" if is_subject_q else "assistant"

                print(f"DEBUG: Routing to LangGraph Brixbee Agent (type={interaction_type})...")
                agent_answer = self.ask_langgraph_agent(user_msg, interaction_type=interaction_type)

                if agent_answer:
                    self.speak(agent_answer)
                else:
                    # Fallback: native AI if LangGraph backend is down
                    print(f"DEBUG: Falling back to native AI (LangGraph unavailable).")
                    self.ask_ai(user_msg, model_type=interaction_type)
                
            time.sleep(0.1)

if __name__ == "__main__":
    print("DEBUG: Starting Brixbee App...")
    app = BrixbeeApp()
    print("DEBUG: App instance created, entering mainloop.")
    app.mainloop()
