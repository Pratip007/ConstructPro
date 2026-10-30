import { sendSuccess, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    return sendSuccess({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
