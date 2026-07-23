import { useEffect, useReducer } from "react";
import { dataService } from "../lib/dataService";

export function useData() {
  const [, refresh] = useReducer((value) => value + 1, 0);
  useEffect(() => dataService.subscribe(refresh), []);
  return dataService;
}
