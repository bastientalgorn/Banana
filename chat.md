Let's try another compression method on top of what's existing. 
Let's define N =  5
Iterate over categories
In each category, iterate over the templates in alphabetic order.
For item i, find the last item j, with j>i, such that the 2 conditions are met:
    Condition 1: we define "name_base" as the name of item i, trimmed to keep only the first N words. Condition 2 is satistied if items i to j (included) start with "name_base". 
    Condition 2: if we look at the min and max value of calories per item in itmes i to j (included), we should have min > 0, and max < 1.2*min
  If both conditions are met, then we can merge items i to j (included)
  The merged element is made of:
    name = the largest string such that all the templates start with that string (which might be longer than name_base). (We might have to also add a closing parenthesis if there is an open, non closed parenthesis in the name)
    calories = average over items i to j.