
export interface RoomMapping {
  [id: string]: string;
}

export interface SeatRequest {
  clientId: string;
  libId: number;
  seatNumber: string;
  mode: number; // 1 = 预约模式, 2 = 即时模式
  timeStr: string;
  cookieStr: string;
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data?: T;
}

export async function getMappings(): Promise<{ rooms: RoomMapping }> {
  const response = await fetch('/api/mappings');
  if (!response.ok) {
    throw new Error('Failed to fetch mappings');
  }
  return response.json();
}

export async function submitRequest(request: SeatRequest): Promise<ApiResponse<void>> {
  const response = await fetch('/api/submit_request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Request failed');
  }

  return response.json();
}

export async function cancelTask(clientId: string): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/cancel_task/${clientId}`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Failed to cancel task');
  }
  return response.json();
}
