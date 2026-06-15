// this thing will be send by the enige when it gets ON_RAMP to perform;
export interface ToEngineOnRamp {
  amount: number;
  userId: string;
  loopbackid: string;
}
