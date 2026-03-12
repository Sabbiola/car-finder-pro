BRANDS = [
    "Audi",
    "BMW",
    "Fiat",
    "Ford",
    "Jeep",
    "Mercedes-Benz",
    "Peugeot",
    "Renault",
    "Tesla",
    "Toyota",
    "Volkswagen",
]

MODELS_BY_BRAND: dict[str, list[str]] = {
    "BMW": ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "X1", "X3", "X5", "iX"],
    "Audi": ["A1", "A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "e-tron"],
    "Mercedes-Benz": ["Classe A", "Classe B", "Classe C", "Classe E", "GLA", "GLC", "GLE", "EQA"],
    "Volkswagen": ["Golf", "Polo", "T-Roc", "Tiguan", "T-Cross", "Passat", "ID.3", "ID.4"],
    "Fiat": ["500", "500X", "Panda", "Tipo", "600"],
    "Toyota": ["Yaris", "Yaris Cross", "Corolla", "C-HR", "RAV4", "Aygo X"],
    "Ford": ["Fiesta", "Focus", "Puma", "Kuga", "Mustang Mach-E"],
    "Renault": ["Clio", "Captur", "Megane", "Arkana", "Austral"],
    "Peugeot": ["208", "308", "2008", "3008", "5008", "e-208"],
    "Tesla": ["Model 3", "Model Y", "Model S", "Model X"],
    "Jeep": ["Renegade", "Compass", "Avenger", "Wrangler"],
}

TRIMS_BY_BRAND_MODEL: dict[str, dict[str, list[str]]] = {
    "BMW": {
        "Serie 3": ["316d", "318d", "320d", "320d xDrive", "330i", "330e", "M340i xDrive"],
        "Serie 4": ["420d", "420d xDrive", "430i", "M440i xDrive"],
        "X3": ["xDrive20d", "xDrive30d", "xDrive30e", "M40i"],
    },
    "Audi": {
        "A3": ["30 TFSI", "35 TFSI", "35 TDI", "40 TFSI e", "S3", "RS3"],
        "A4": ["30 TDI", "35 TFSI", "40 TDI", "45 TFSI", "S4", "RS4"],
    },
    "Mercedes-Benz": {
        "Classe A": ["A 160", "A 180", "A 200", "A 200d", "A 250e", "AMG A 35"],
        "Classe C": ["C 180", "C 200", "C 220d", "C 300", "C 300e"],
    },
    "Volkswagen": {
        "Golf": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "GTE", "GTI", "R"],
        "Tiguan": ["1.5 TSI", "2.0 TDI", "2.0 TSI", "1.4 eHybrid"],
    },
    "Tesla": {
        "Model 3": ["Standard Range", "Long Range", "Performance"],
        "Model Y": ["Standard Range", "Long Range", "Performance"],
    },
}
