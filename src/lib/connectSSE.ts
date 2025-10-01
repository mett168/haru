export function connectSSE(onData: (data: any) => void) {
  const eventSource = new EventSource('http://localhost:3001/api/sse');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('📡 SSE 수신 데이터:', data);
      onData(data);
    } catch (err) {
      console.error('❌ SSE JSON 파싱 실패:', event.data);
    }
  };

  eventSource.onerror = (err) => {
    console.error('❌ SSE 연결 오류:', err);
    eventSource.close();
  };

  return eventSource;
}
