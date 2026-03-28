// Keep mockData only for type exports used elsewhere - actual data now comes from Supabase
export interface Entregador {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  veiculo: string;
  foto: string;
  status: 'online' | 'offline';
  ganhos_dia: number;
  entregas_hoje: number;
}

export interface Pedido {
  id: string;
  restaurante_nome: string;
  restaurante_id: string;
  cliente_nome: string;
  endereco_coleta: string;
  endereco_entrega: string;
  valor_entrega: number;
  distancia: string;
  tempo_estimado: string;
  status: 'disponivel' | 'em_andamento' | 'coletado' | 'a_caminho' | 'entregue';
  entregador_id?: string;
  data: string;
}

export interface HistoricoEntrega {
  id: string;
  restaurante_nome: string;
  data: string;
  valor: number;
  distancia: string;
  status: 'entregue';
}
