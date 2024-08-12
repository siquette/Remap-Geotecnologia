// Definir a área de interesse (AOI)
var aoi = ee.Geometry.Polygon([
    [[-58.389544224642215, -11.200339407332578],
     [-58.389544224642215, -13.336554634910579],
     [-55.906634068392215, -13.336554634910579],
     [-55.906634068392215, -11.200339407332578]]
  ]);
  
  Map.centerObject(aoi, 10);
  
  // Função para mascarar nuvens usando a banda QA60 do Sentinel-2
  function mascararNuvens(imagem) {
    var qa = imagem.select('QA60');
    var mascaraNuvem = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
    return imagem.updateMask(mascaraNuvem).divide(10000);
  }
  
  // Função para criar um mosaico anual
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
  
  // Criar o mosaico para 2023
  var mosaico2023 = criarMosaico(2023);
  Map.addLayer(mosaico2023, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Mosaico 2023');
  
  // Coleta de amostras de treinamento
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
  
  // Definir bandas a serem utilizadas
  var bands = ['B4', 'B3', 'B2', 'B8'];
  
  // Amostrar os dados de treinamento
  var trainingData = mosaico2023.select(bands).sampleRegions({
    collection: trainingPoints,
    properties: ['class'],
    scale: 10
  });
  
  // Treinamento do classificador Random Forest
  var classifier = ee.Classifier.smileRandomForest(50)
    .train({
      features: trainingData,
      classProperty: 'class',
      inputProperties: bands
    });
  
  // Classificação do mosaico de 2023
  var classified_2023 = mosaico2023.select(bands).classify(classifier);
  
  // Exibir o resultado da classificação
  Map.centerObject(aoi, 8);
  Map.addLayer(classified_2023, {min: 0, max: 2, palette: ['green', 'yellow', 'brown']}, 'Classificação 2023');
  
  // Avaliação da acurácia
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
  
  // Cálculo da área de agricultura para 2023
  var agricultureArea_2023 = classified_2023.eq(1).multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9
  });
  
  print('Área de Agricultura em 2023 (m²):', agricultureArea_2023);
  
  // Função para adicionar uma legenda
  function addLegend(map) {
    var legend = ui.Panel({
      style: {
        position: 'bottom-left',
        padding: '8px 15px'
      }
    });
  
    var legendTitle = ui.Label({
      value: 'Legenda de Classificação',
      style: {fontWeight: 'bold', fontSize: '18px', margin: '0 0 6px 0', padding: '0'}
    });
    legend.add(legendTitle);
  
    var makeRow = function(color, name) {
      var colorBox = ui.Label({
        style: {
          backgroundColor: color,
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
  
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
  
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
    };
  
    var palette = ['green', 'yellow', 'brown'];
    var names = ['Vegetação', 'Agricultura', 'Área Não Plantada'];
  
    for (var i = 0; i < palette.length; i++) {
      legend.add(makeRow(palette[i], names[i]));
    }
  
    map.add(legend);
  }
  
  // Adicionar legenda ao mapa
  addLegend(Map);
  
  
  // Definir a área de interesse (AOI)
  var aoi = ee.Geometry.Polygon([
    [[-58.389544224642215, -11.200339407332578],
     [-58.389544224642215, -13.336554634910579],
     [-55.906634068392215, -13.336554634910579],
     [-55.906634068392215, -11.200339407332578]]
  ]);
  
  Map.centerObject(aoi, 10);
  
  // Função para mascarar nuvens usando a banda QA60 do Sentinel-2
  function mascararNuvens(imagem) {
    var qa = imagem.select('QA60');
    var mascaraNuvem = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
    return imagem.updateMask(mascaraNuvem).divide(10000);
  }
  
  // Função para criar um mosaico anual
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
  
  // Criar o mosaico para 2017
  var mosaico2017 = criarMosaico(2017);
  Map.addLayer(mosaico2017, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Mosaico 2017');
  
  // Coleta de amostras de treinamento
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
  
  // Definir bandas a serem utilizadas
  var bands = ['B4', 'B3', 'B2', 'B8'];
  
  // Amostrar os dados de treinamento
  var trainingData = mosaico2017.select(bands).sampleRegions({
    collection: trainingPoints,
    properties: ['class'],
    scale: 10
  });
  
  // Treinamento do classificador Random Forest
  var classifier = ee.Classifier.smileRandomForest(50)
    .train({
      features: trainingData,
      classProperty: 'class',
      inputProperties: bands
    });
  
  // Classificação do mosaico de 2017
  var classified_2017 = mosaico2017.select(bands).classify(classifier);
  
  // Exibir o resultado da classificação
  Map.centerObject(aoi, 8);
  Map.addLayer(classified_2017, {min: 0, max: 2, palette: ['green', 'yellow', 'brown']}, 'Classificação 2017');
  
  // Avaliação da acurácia
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
  
  // Cálculo da área de agricultura para 2017
  var agricultureArea_2017 = classified_2017.eq(1).multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9
  });
  
  print('Área de Agricultura em 2017 (m²):', agricultureArea_2017);