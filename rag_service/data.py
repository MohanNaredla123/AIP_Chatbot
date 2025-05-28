import os
import json

class Data:
    def __init__(self):
        self.roles = {
            '1': 'District Absence Coordinator', 
            '2': 'School Absence Coordinator',
            '3': 'PED Viewer',
            '4': 'PED Absence Coordinator',
            '5': 'IT Administrator'
        }
        self.config_path = 'config/role_config.json'
        self.role = self._get_role_from_config()
        self.data_path = f"data/manuals/{self.role} Manual.txt"
        self.faiss_dir = f"data/index{self.role.split(' ')[0]}/faiss"
        self.bm25_dir = f"data/index{self.role.split(' ')[0]}/bm25.pkl"
    
    def _get_role_from_config(self):
        default_role = '1'
        
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            
            if not os.path.exists(self.config_path):
                with open(self.config_path, 'w') as f:
                    json.dump({"role": default_role}, f)
                return self.roles.get(default_role, 'School Absence Coordinator')
            
            with open(self.config_path, 'r') as f:
                config = json.load(f)
                role_no = config.get("role", default_role)
                return "PED Roles" if role_no in ['3', '4', '5'] else self.roles.get(role_no, '1')
                
        except Exception as e:
            print(f"Error reading config: {e}")
            return self.roles.get(default_role, 'School Absence Coordinator')
    
    @staticmethod
    def update_role(new_role):
        config_path = 'config/role_config.json'
        
        try:
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            with open(config_path, 'w') as f:
                json.dump({"role": new_role}, f)
            return True
        
        except Exception as e:
            print(f"Error updating role: {e}")
            return False