from datetime import datetime

class UserBehaviorProfile:
    def __init__(self, user_data):
        self.name = user_data.get('name', 'User')
        self.age = user_data.get('age', 25)
        self.role = user_data.get('role', 'professional').lower()
        self.field = user_data.get('field', 'General') 
        self.height = user_data.get('height', 175)
        self.weight = user_data.get('weight', 70)

    def get_bmi_status(self):
        h_m = self.height / 100
        bmi = round(self.weight / (h_m ** 2), 1)
        if bmi >= 25: return f"BMI {bmi} (Overweight). MANDATE: Fat Burn Cardio."
        if bmi >= 30: return f"BMI {bmi} (Obese). MANDATE: Walking + Low Impact."
        if bmi < 18.5: return f"BMI {bmi} (Underweight). MANDATE: Strength Training."
        return f"BMI {bmi} (Healthy). Maintain activity."

    def get_routine_map(self):
        if 'student' in self.role:
            return [{"time": "08:00-14:00", "location": "College", "type": "fixed", "title": "Classes"}]
        elif 'professional' in self.role:
            return [{"time": "09:00-17:00", "location": "Office", "type": "fixed", "title": "Work"}]
        return []

def get_maeve_current_activity():
    hour = datetime.now().hour
    
    if 1 <= hour < 8:
        return "You are fast asleep in bed. If he wakes you up, you are groggy, confused, and maybe a little annoyed."
    elif 9 <= hour < 17:
        return "You are busy with your own work/studies. Your replies should be a bit shorter and distracted."
    elif 19 <= hour < 21:
        return "You are watching your favorite web series, chilling on couch."
    else:
        return "You are completely free and giving him your full attention."
