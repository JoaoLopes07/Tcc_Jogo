import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

class AIService:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('GEMINI_API_KEY')
        self.model = None
        self.lore_db = self._carregar_lore()
        self._configurar_modelo()

    def _carregar_lore(self):
        try:
            # Sobe 3 níveis para achar o lore.json na raiz do backend
            base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            with open(os.path.join(base_path, 'lore.json'), 'r', encoding='utf-8') as f:
                return json.load(f)
        except: return {}

    def _configurar_modelo(self):
        if not self.api_key:
            print("❌ IA: Sem chave API. Verifique o .env")
            return

        genai.configure(api_key=self.api_key)
        print("🔍 IA: Escaneando modelos disponíveis na sua conta...")

        try:
            # 1. Pega a lista REAL de modelos que sua conta tem acesso
            todos_modelos = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            
            # 2. Define prioridades (Do mais novo/rápido para o antigo)
            preferencias = [
                'models/gemini-2.5-flash',          # O mais novo e rápido
                'models/gemini-2.0-flash',          # Ótima alternativa
                'models/gemini-1.5-flash',          # Versão anterior
                'models/gemini-pro'                 # Fallback clássico
            ]
            
            modelo_escolhido = None
            
            # Tenta casar a preferência com o que você tem
            for pref in preferencias:
                # Procura parcial (ex: se tiver 'models/gemini-2.5-flash-001', o 'gemini-2.5-flash' pega)
                match = next((m for m in todos_modelos if pref in m), None)
                if match:
                    modelo_escolhido = match
                    break
            
            # Se não achou nenhum da lista, pega qualquer um que seja "flash"
            if not modelo_escolhido:
                modelo_escolhido = next((m for m in todos_modelos if 'flash' in m), None)
            
            # Se ainda não achou, pega o primeiro da lista geral
            if not modelo_escolhido and todos_modelos:
                modelo_escolhido = todos_modelos[0]

            if modelo_escolhido:
                print(f"✅ IA CONECTADA: {modelo_escolhido}")
                self.model = genai.GenerativeModel(modelo_escolhido)
            else:
                print("❌ ERRO: Nenhum modelo de texto encontrado na sua conta.")
                # Tenta o fallback final
                self.model = genai.GenerativeModel('gemini-pro')

        except Exception as e:
            print(f"⚠️ Erro na seleção automática ({e}). Usando fallback.")
            self.model = genai.GenerativeModel('gemini-pro')

    def _sistema_rag(self, msg):
        msg = msg.lower()
        contexto = []
        if "monstros" in self.lore_db:
            for k, v in self.lore_db["monstros"].items():
                if k in msg: contexto.append(f"[RAG MONSTRO: {k.upper()}]: {v}")
        if "locais" in self.lore_db:
            for k, v in self.lore_db["locais"].items():
                if k in msg: contexto.append(f"[RAG LOCAL]: {v}")
        return "\n".join(contexto)

    def gerar_narrativa(self, system_context, history, user_msg):
        if not self.model: return "Erro: IA Offline."
        
        rag_info = self._sistema_rag(user_msg)
        if rag_info: 
            system_context += f"\n\nCONHECIMENTO DO MUNDO:\n{rag_info}"

        # Histórico limitado a 3 para economizar tokens
        full_prompt = f"{system_context}\n\nHistórico:\n"
        for h in history[-3:]: 
            full_prompt += f"{h['content']}\n"
        full_prompt += f"\nAÇÃO DO GRUPO:\n{user_msg}\n\nMESTRE:"

        try:
            chat = self.model.start_chat(history=[])
            return chat.send_message(full_prompt).text
        except Exception as e:
            erro = str(e)
            if "429" in erro: return "⚠️ O Mestre está sobrecarregado (Muitas ações). Espere 30 segundos."
            return f"O Mestre hesitou (Erro API): {erro}"

# Cria uma instância global para ser usada nas rotas
ai_engine = AIService()