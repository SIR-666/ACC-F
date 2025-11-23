import http from "./http";

export const getAllData = () => http.get("/types");
export const getDataByType = (type) => http.get(`/types/${id}`);
export const createtype = (data) => http.post("/types", data);
export const deletetype = (id) => http.delete(`/types/${id}`);
