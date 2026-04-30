import os
import json
import time
import tempfile

def load_json(filename, default_val):
    for i in range(5): # 5 baar try karega agar file locked hai
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                time.sleep(0.1) # Thoda ruko phir try karo
                continue
    return default_val

def save_json(filename, data):
    # Atomic Write with Auto-Cleanup: Taki file lock hone par tmp files na bharein
    dir_name = os.path.dirname(os.path.abspath(filename))
    tempname = None
    
    for i in range(5): 
        try:

            with tempfile.NamedTemporaryFile('w', dir=dir_name, delete=False, encoding='utf-8') as tf:
                json.dump(data, tf, indent=4)
                tempname = tf.name
            
            # 2. Main file ko replace karne ki koshish
            os.replace(tempname, filename)
            return # Agar success hua toh function yahan se khatam
            
        except PermissionError:
            # 3. Agar Windows ne file lock ki hai, toh banayi hui TMP file delete kar do
            if tempname and os.path.exists(tempname):
                try:
                    os.remove(tempname)
                except:
                    pass
            time.sleep(0.1) # Thoda ruko aur wapas try karo
            
        except Exception as e:
            # Kisi aur error aane par bhi tmp file delete kar do
            if tempname and os.path.exists(tempname):
                try:
                    os.remove(tempname)
                except:
                    pass
            break
