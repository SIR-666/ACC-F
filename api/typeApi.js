import http from "./http";

export const getType = () => http.get("/types");
export const gettypeById = (id) => http.get(`/types/${id}`);
export const createtype = (data) => http.post("/types", data);
export const deletetype = (id) => http.delete(`/types/${id}`);
