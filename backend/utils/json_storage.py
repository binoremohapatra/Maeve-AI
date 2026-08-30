import os
import json
import time
import tempfile

def load_json(filename, default_val):
    for i in range(5): 
        if os.path.exists(filename):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                time.sleep(0.1) 
                continue
    return default_val

def save_json(filename, data):
    
    dir_name = os.path.dirname(os.path.abspath(filename))
    tempname = None
    
    for i in range(5): 
        try:

            with tempfile.NamedTemporaryFile('w', dir=dir_name, delete=False, encoding='utf-8') as tf:
                json.dump(data, tf, indent=4)
                tempname = tf.name
            
           
            os.replace(tempname, filename)
            return 
            
        except PermissionError:
           
            if tempname and os.path.exists(tempname):
                try:
                    os.remove(tempname)
                except:
                    pass
            time.sleep(0.1) 
            
        except Exception as e:
        
            if tempname and os.path.exists(tempname):
                try:
                    os.remove(tempname)
                except:
                    pass
            break
