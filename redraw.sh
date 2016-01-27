#!/bin/bash

#while true 
#do 
OUTPUT=$(xdotool getactivewindow)
xdotool windowminimize "$OUTPUT"
xdotool windowmap "$OUTPUT"
#sleep 2 &
#xdotool windowmove $(xdotool getactivewindow) x+0 y+0
#done