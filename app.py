import os
import csv
import math
import time

from flask import (Flask, redirect, render_template, request,
                   send_from_directory, url_for, jsonify)

app = Flask(__name__)

def jumpSearch(arr, upc):
    size = len(arr)  # find the amount of rows in the array
    step = math.floor(math.sqrt(size))  # step is the square root of the size

    prev = 0
    while arr[int(min(step, size)) - 1] < upc:
        prev = step  # replace previous value
        step += math.sqrt(size)  # increase the step
        if prev >= size:  # if the end of the list is met or the list is empty
            return -1

    while arr[int(prev)] < upc:
        prev += 1  # iterate through the step

        # if the end of the arr is reached
        if prev == min(step, size):
            return -1

    # if the element is found
    if arr[int(prev)] == upc:
        return int(prev)

    return -1

def ternarySearch(arr, upc):

    #Getting the beginning and end index of the array
    left = 0
    right = len(arr) - 1

    while left <= right:

        #Splits the dataset into thirds
        ind1 = left + (right-left) // 3
        ind2 = right - (right - left) // 3

        # Checks if the UPC matches with the first or last item in the array
        if upc == arr[left]:
            return left
        elif upc == arr[right]:
            return right
        elif upc < arr[left] or upc > arr[right]:
            print('Unable to find key')
            return
        #upc is in first third
        elif upc <= arr[ind1]:
            right = ind1
        #upc is in second third
        elif arr[ind1] < upc <= arr[ind2]:
            left = ind1 + 1
            right = ind2
        #upc is in last third
        else:
            left = ind2 + 1

    return -1

def ingredientMatching(list, targets):
    list_arr = set([item.lower().replace(' ', '_') for item in list.split(', ')])
    matches = set(targets.intersection(list_arr))
    return matches

def searchBarcode(upc, method):
    arr = []
    sampleFilePath = 'data/branded_food_sorted_no_duplicates.csv'
    with open(sampleFilePath, 'r', newline='') as sampleFile:
        csv_reader = csv.reader(sampleFile)

        sampleHeaders = next(csv_reader, None)

        # Repair broken UPCs
        if sampleHeaders:
            for column in csv_reader:
                if column[4].strip().isdigit():
                    # This formatting ensures Python does not print the UPC in scientific notation
                    arr.append(int(column[4]))
                else:
                    # A few of the UPCs contain dashes. This removes them before continuing
                    fixed = column[4].replace('-', '')
                    arr.append(int(fixed))
        
    if(method == 'jump'):
        index = jumpSearch(arr, int(upc))
    else:
        index = ternarySearch(arr, int(upc))
    if index == None or index == -1:
        return -1
    with open(sampleFilePath, 'r', newline='') as sampleFile:
        csv_reader = csv.reader(sampleFile)
        sampleHeaders = next(csv_reader, None)
        for i in range(index):  # count from 0 to index
            next(csv_reader)  # discard the rows before
        row = next(csv_reader)  # row wanted
        return ([row[1], row[5]])

def checkIngredients(ingredients):
    harmfuls = {'red_40', 'yellow_5', 'blue_1', 'blue_2',
                'yellow_6', 'high_fructose_corn_syrup', 'sodium_nitrate', 'caramelized_sugar_syrup',
                'potassium_bromate', 'monosodium_glutamate', 'sodium_benzoate', 'sodium_nitrite', 'sodium_sulfite',
                'sulfur_dioxide', 'propyl_paraben', 'butylated_hydroxyanisole', 'butylated_hydroxytoluene', 'potassium_bisulfite',
                'sodium_bisulfite', 'sodium_metabisulfite', 'sodium_benzoate', 'ethylenediamine_tetraacetic_acid', 'sorbic_acid', 'propylene_glycol'
                }
    return ingredientMatching(ingredients, harmfuls)

def checkAllergens(ingredients):
    allergens = {'milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soybeans', 'soy'}
    return ingredientMatching(ingredients, allergens)

@app.route('/')
def scan():
   print('Request for scan page received')
   return render_template('scan.html')

@app.route('/qr')
def qr():
    print('Request for qr page received')
    return render_template('qr_test.html')

@app.route('/searchbarcode', methods=['POST'])
def searchbarcode():
    if request.method == 'POST':
        startTime = time.time();
        data = request.get_json()
        barcode = data.get('barcode')
        method = data.get('method')
        print('Request for ' + barcode + ' received with method ' + method)
        if barcode:
            item = searchBarcode(barcode, method);
            if item == None or item == -1:
                return jsonify({'title': 'Not Found', 'status': 'BAD', 'allergens': '', 'harmfuls': ''})  
            foundAllergens = checkAllergens(item[1])
            foundAllergens = [string.replace('_', ' ').capitalize() for string in foundAllergens]
            foundHarmfuls = checkIngredients(item[1])
            foundHarmfuls = [string.replace('_', ' ').capitalize() for string in foundHarmfuls]
            status = ''
            elapsedTime = math.ceil((time.time() - startTime)*1000)
            if (len(foundAllergens) > 0) & (len(foundHarmfuls) > 0):
                status = 'AH'
            elif (len(foundAllergens) > 0) & (len(foundHarmfuls) == 0):
                status = 'A'
            elif (len(foundAllergens) == 0) & (len(foundHarmfuls) > 0):
                status = 'H'
            else:
                status = 'OK'    
            return jsonify({'title': item[0], 'status': status, 'allergens': list(foundAllergens), 'harmfuls': list(foundHarmfuls), 'time': elapsedTime})
        else:
            return jsonify({'error': 'Barcode value not found in the request.'}), 400

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico')

@app.errorhandler(404)
def page_not_found(error):
    return redirect('/')

if __name__ == '__main__':
    app.run()

