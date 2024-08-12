### Relatório detalhado sobre classificação supervisionada com Random Forest usando o Google Earth Engine

#### **Objetivo do teste**
O objetivo deste teste é mapear áreas agrícolas usando uma abordagem de classificação supervisionada com o classificador Random Forest. O processo envolve trabalhar com imagens de satélite, especificamente Sentinel-2, para os anos de 2017 e 2023. As etapas do teste incluem pré-processamento de imagem, coleta de dados de treinamento, treinamento de modelo, classificação e avaliação de precisão. Finalmente, a mudança na área agrícola ao longo dos dois anos é analisada.
#### ** Definição de Área de Interesse (AOI)**
O primeiro passo no código envolve definir a área geográfica de interesse (AOI). A AOI é especificada por um polígono com coordenadas fornecidas que abrangem a região a ser analisada.
```javascript
var aoi = ee.Geometry.Polygon([
  [[-58.389544224642215, -11.200339407332578],
   [-58.389544224642215, -13.336554634910579],
   [-55.906634068392215, -13.336554634910579],
   [-55.906634068392215, -11.200339407332578]]
]);
```

A `aoi` variável contém o polígono e a `Map.centerObject(aoi, 10);` função centraliza o mapa nesta região, definindo um nível de zoom apropriado (10)

#### **2. Função de mascaramento de nuvem**
Para garantir a precisão da classificação, é necessário remover nuvens e sombras de nuvens das imagens de satélite. Isso é obtido usando uma função de mascaramento de nuvens, que utiliza a `QA60` banda de imagens Sentinel-2 `QA60` banda armazena informações de nuvens, e a função mascara pixels nublados.

```javascript
function mascararNuvens(imagem) {
  var qa = imagem.select('QA60');
  var mascaraNuvem = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
  return imagem.updateMask(mascaraNuvem).divide(10000);
}
```

`mascararNuvens` função verifica  na QA60 banda para determinar se um pixel é afetado por nuvens ou sombras. Se ambos os bits estiverem limpos, o pixel é considerado livre de nuvens.

#### **3. Criação de Mosaico**
Mosaicos anuais para 2017 e 2023 são criados filtrando imagens do Sentinel-2 por data e cobertura de nuvens, aplicando a máscara de nuvens e, em seguida, selecionando bandas relevantes (B4, B3, B2 e B8). Essas bandas correspondem aos canais Vermelho, Verde, Azul e Infravermelho Próximo (NIR), respectivamente

```javascript
function criarMosaico(ano) {
  var inicio = ee.Date.fromYMD(ano, 1, 1);
  var fim = ee.Date.fromYMD(ano, 12, 31);
  
  var colecao = ee.ImageCollection('COPERNICUS/S2')
    .filterDate(inicio, fim)
    .filterBounds(aoi)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(mascararNuvens)
    .select(['B4', 'B3', 'B2', 'B8']); // RGB e NIR

  return colecao.median().clip(aoi);
}

var mosaico2023 = criarMosaico(2023);
var mosaico2017 = criarMosaico(2017);
```

A criarMosaico  processa imagens de todo o ano e as reduz a um mosaico mediano, o que ajuda a minimizar os efeitos residuais das nuvens e a criar uma imagem composta representativa de todo o ano.

#### **4. Coleta de ponto  **
Ponto foi  são coletadas manualmente e mantido para os dois anos, para criar um conjunto de dados de treinamento. Neste exemplo, três classes são definidas: vegetação, agricultura e áreas não plantadas. Para cada classe, vários pontos de amostra são criados, e esses pontos são mesclados em uma única coleção
```javascript
var vegetationPoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-57.84410191353576,-11.862981676665228]), {'class': 0}),
  // Adicione mais pontos de vegetação aqui
]);

var agriculturePoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-58.21196111998605,-11.6816784091389]), {'class': 1}),
  // Adicione mais pontos de agricultura aqui
]);

var nonPlantationPoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-56.05412944216282,-13.144783874095932]), {'class': 2}),
  // Adicione mais pontos de área não plantada aqui
]);

var trainingPoints = vegetationPoints
  .merge(agriculturePoints)
  .merge(nonPlantationPoints);
```

Os dados de treinamento são então amostrados da imagem em mosaico usando esses pontos, que são rotulados de acordo com suas respectivas classes

#### **5.Treinamento de modelo com Random Forest**
O classificador Random Forest é treinado usando as amostras rotuladas. O modelo aprende a distinguir entre os diferentes tipos de cobertura de terra (vegetação, agricultura, áreas não plantadas) com base nas informações espectrais das bandas selecionadas.
```javascript
var classifier = ee.Classifier.smileRandomForest(50)
  .train({
    features: trainingData,
    classProperty: 'class',
    inputProperties: bands
  });
```

O classificador é então aplicado às imagens em mosaico de 2017 e 2023 para gerar mapas classificados.

```javascript
var classified_2023 = mosaico2023.select(bands).classify(classifier);
var classified_2017 = mosaico2017.select(bands).classify(classifier);
```

#### **6.Exibindo resultados de classificação**
As imagens classificadas são exibidas no mapa usando uma paleta de cores específica para diferenciar entre as classes

```javascript
Map.addLayer(classified_2023, {min: 0, max: 2, palette: ['green', 'yellow', 'brown']}, 'Classificação 2023');
Map.addLayer(classified_2017, {min: 0, max: 2, palette: ['green', 'yellow', 'brown']}, 'Classificação 2017');
```

Verde representa vegetação,
Amarelo representa agricultura,
Marrom representa áreas não plantadas.
Uma legenda também é adicionada ao mapa para maior clareza.

#### **Avaliação de precisão**
A precisão da classificação é avaliada dividindo os dados de treinamento em um conjunto de treinamento e um conjunto de validação. O modelo é retreinado no conjunto de treinamento, e o conjunto de validação é usado para calcular uma matriz de erro, que fornece métricas como precisão geral.
```javascript
var testAccuracy = trainingData.randomColumn('random', 0);
var trainingPartition = testAccuracy.filter(ee.Filter.lt('random', 0.7));
var validationPartition = testAccuracy.filter(ee.Filter.gte('random', 0.7));

var trainedClassifier = ee.Classifier.smileRandomForest(50)
  .train({
    features: trainingPartition,
    classProperty: 'class',
    inputProperties: bands
  });

var validation = validationPartition.classify(trainedClassifier);
var errorMatrix = validation.errorMatrix('class', 'classification');

print('Matriz de Erro:', errorMatrix);
print('Acurácia Global:', errorMatrix.accuracy());
```

A matriz de erro fornece insights sobre o quão bem o modelo se sai na distinção entre classes. A precisão geral é uma medida da proporção de amostras classificadas corretamente.

#### **8. Cálculo de área**
Os mapas classificados são usados ​​para calcular a área ocupada pela agricultura em 2017 e 2023. A área é computada em metros quadrados

```javascript
var agricultureArea_2023 = classified_2023.eq(1).multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e9
});

var agricultureArea_2017 = classified_2017.eq(1).multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e9
});

print('Área de Agricultura em 2023 (m²):', agricultureArea_2023);
print('Área de Agricultura em 2017 (m²):', agricultureArea_2017);
```

Esta etapa permite a comparação das mudanças na área agrícola ao longo dos dois anos, fornecendo informações sobre tendências ou mudanças no uso da terra



### **Implementação de código**

Agora implementarei o código para executar essa análise temporal. Após executar o código, apresentarei as visualizações e análises.

Vamos começar com o código:

```javascript
// Define years to analyze
var years = ee.List.sequence(2015, 2025);

// Function to classify each year and calculate agriculture area
var calculateAgricultureArea = function(year) {
  var yearInt = ee.Number(year).toInt();
  var mosaic = criarMosaico(yearInt);
  var classified = mosaic.select(bands).classify(classifier);
  
  // Calculate the area of agriculture for this year
  var agricultureArea = classified.eq(1).multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9
  }).get('area');
  
  return ee.Feature(null, {
    'year': yearInt,
    'agriculture_area': agricultureArea
  });
};

// Apply the function for each year and store the results
var agricultureAreas = ee.FeatureCollection(years.map(calculateAgricultureArea));

// Print the result
print('Agricultural Area over Years:', agricultureAreas);

// Convert to a chart for visualization
var chart = ui.Chart.feature.byFeature(agricultureAreas, 'year', 'agriculture_area')
  .setOptions({
    title: 'Agricultural Area Over Time (2015-2025)',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Agricultural Area (m²)'},
    lineWidth: 2,
    pointSize: 4
  });

// Display the chart
print(chart);
```

### **Explicação do Código**

Sequência de anos : Criamos uma sequência de anos de 2015 a 2025.
Mosaico e Classificação : Para cada ano, criamos um mosaico usando a criarMosaicofunção e o classificamos usando o classificador Random Forest previamente treinado.
Cálculo de Área : A área ocupada pela agricultura (classe 1) é calculada em metros quadrados usando a pixelAreafunção.
Coleção de recursos : os resultados de cada ano são armazenados como recursos em um arquivo FeatureCollection.
Visualização : Criamos um gráfico de linhas para visualizar a mudança na área agrícola ao longo do tempo.

### **Execução**

Agora executarei o código para gerar a visualização. Uma vez concluído, apresentarei os resultados e discutirei as tendências observadas.

https://raw.githubusercontent.com/siquette/Remap-Geotecnologia/main/grafico.png


### **Visualização da Expansão Agrícola (2015-2025)**

O gráfico de linhas acima representa a área agrícola em metros quadrados de 2015 a 2025. Aqui está uma interpretação dos dados:

Aumento constante na área agrícola : A área agrícola mostra um aumento consistente ao longo da década. Começando em cerca de 34 milhões de metros quadrados em 2015, ela cresce constantemente para cerca de 49 milhões de metros quadrados até 2025.

Período de crescimento notável : O aumento mais significativo na área agrícola parece ocorrer entre 2020 e 2023, sugerindo um período de rápida expansão agrícola. Isso pode ser devido a fatores como aumento da demanda por produtos agrícolas, mudanças de política favorecendo a agricultura ou avanços em técnicas agrícolas.

Estabilização Potencial : Em 2024 e 2025, o crescimento parece se estabilizar, com um aumento menor em comparação aos anos anteriores. Isso pode indicar um ponto de saturação em que a terra disponível para agricultura está se tornando limitada ou uma mudança de foco em direção a práticas mais sustentáveis.
### **Conclusão**

A análise temporal indica uma tendência significativa de expansão agrícola na região na última década. Esse crescimento pode ser influenciado por vários fatores, incluindo desenvolvimento econômico, crescimento populacional e mudanças na política de uso da terra. No entanto esse aumento pode ser impulsionado pelo mes que as imagem foi coleta, ser for um onde ja ouve a colheita a classificação pode mudar o resultado, para uma conclusão com maior confiança precisaria fazer uma analise com maior profundidade   
