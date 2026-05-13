export type OdooProduct = {
  id: number;
  name: string;
  barcode: string | false;
  qty_available: number;
};

export type OdooJsonRpcError = {
  code: number;
  message: string;
  data?: {
    name?: string;
    debug?: string;
    message?: string;
  };
};
