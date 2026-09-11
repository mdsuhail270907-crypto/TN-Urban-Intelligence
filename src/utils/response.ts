type ResponsePayload<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
};

export const formatSuccessResponse = <T>(data: T, message = 'Request successful'): ResponsePayload<T> => ({
  success: true,
  data,
  message
});

export const formatErrorResponse = (code: string, message: string): ResponsePayload<never> => ({
  success: false,
  error: {
    code,
    message
  }
});
