import {Counter , Histogram , Registry , collectDefaultMetrics } from "prom-client"
export const register = new Registry();
collectDefaultMetrics({register});

export const httpRequestTotal = new Counter({
    name:"http_request_total",
    help:"Toatal HTTP request",
    labelNames: ["methode" , "route" , "status"],
    registers: [register]
})

export const httpRequestDuration = new Histogram({
    name:"http_request_duration_seconds",
    help:"HTTP  request , latency",
    labelNames: ["methode" , "route" , "status"],
    buckets: [0.01 , 0.05 , 0.1 , 0.3 , 0.5 , 1 , 2 , 5],
    registers : [register]
})

export const rateLimitHitsTotal = new Counter({
    name: "rate_limit_hits_total",
    help: "Toatl rate limit rejections (429)",
    registers : [register]
})