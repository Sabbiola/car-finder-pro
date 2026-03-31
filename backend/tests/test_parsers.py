from app.providers.automobile.parser import parse_automobile_markdown
from app.providers.autoscout24.parser import (
    parse_autoscout_detail_markdown,
    parse_autoscout_markdown,
)
from app.providers.brumbrum.parser import parse_brumbrum_markdown
from app.providers.subito.parser import parse_subito_markdown


def test_parse_autoscout_markdown_extracts_listing() -> None:
    markdown = """
![img](https://prod.pictures.autoscout24.net/listing-images/11111111-1111-1111-1111-111111111111/640x480.jpg)
[BMW 320d M Sport](https://www.autoscout24.it/annunci/bmw-320d-test)
€ 25.500
01/2020
45.000 km
"""
    listings = parse_autoscout_markdown(markdown, "BMW", "320d")
    assert listings
    assert listings[0].provider == "autoscout24"
    assert listings[0].price_amount == 25500


def test_parse_autoscout_markdown_extracts_power_and_seller_type() -> None:
    markdown = """
![img](https://prod.pictures.autoscout24.net/listing-images/22222222-2222-2222-2222-222222222222/640x480.jpg)
[BMW 118 118d cat 5 porte Futura DPF](https://www.autoscout24.it/annunci/bmw-118-test)
€ 4.800
03/2009
256.485 km
Diesel
Automatico
105 kW (143 CV)
Venditore
Rivenditore
Classe emissioni Euro 4
"""
    listings = parse_autoscout_markdown(markdown, "BMW", "118")
    assert listings
    assert listings[0].power == "143 CV"
    assert listings[0].seller_type == "dealer"
    assert listings[0].doors == 5
    assert listings[0].emission_class == "Euro 4"


def test_parse_autoscout_detail_markdown_extracts_core_fields() -> None:
    markdown = """
BMW 118
118d cat 5 porte Futura DPF
Varese - VA
€ 4.800
Chilometraggio
256.485 km
Tipo di cambio
Automatico
Anno
03/2009
Carburante
Diesel
Potenza
105 kW (143 CV)
Venditore
Rivenditore
## Dati di base
Carrozzeria Berlina
Tipo di veicolo Usato
Posti 5
Porte 5
## Ambiente
Classe emissioni Euro 4
## Equipaggiamento
ABS
Isofix
## Descrizione del veicolo
BMW 118d
5 PORTE
CAMBIO AUTOMATICO
"""
    listing = parse_autoscout_detail_markdown(
        markdown,
        source_url="https://www.autoscout24.it/annunci/bmw-118-test",
    )
    assert listing is not None
    assert listing.provider == "autoscout24"
    assert listing.price_amount == 4800
    assert listing.power == "143 CV"
    assert listing.body_style == "Berlina"
    assert listing.seller_type == "dealer"
    assert listing.doors == 5
    assert listing.seats == 5
    assert listing.emission_class == "Euro 4"
    autoscout_payload = (listing.raw_payload or {}).get("autoscout", {})
    assert autoscout_payload.get("specs", {}).get("Classe emissioni") == "Euro 4"
    assert "ABS" in autoscout_payload.get("equipment", [])


def test_parse_subito_markdown_extracts_listing() -> None:
    markdown = """
![img](https://images.sbito.it/test.jpg)
### BMW Serie 3 320d
[link](https://www.subito.it/auto/bmw-serie-3-320d-test.htm)
25.000 €
03/2021 60.000 Km
Milano (MI)
"""
    listings = parse_subito_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "subito"
    assert listings[0].price_amount == 25000


def test_parse_automobile_markdown_extracts_listing() -> None:
    markdown = """
[![img](https://cdn.example.com/car.jpg)](https://www.automobile.it/annunci/test-auto)
### BMW Serie 3 320d
€ 24.900
Marzo 2021
55.000 km
"""
    listings = parse_automobile_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "automobile"
    assert listings[0].price_amount == 24900


def test_parse_brumbrum_markdown_extracts_listing() -> None:
    markdown = """
[BMW Serie 3 320d](https://www.brumbrum.it/usato/bmw-serie-3-320d)
€ 26.500
2022
48.000 km
"""
    listings = parse_brumbrum_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "brumbrum"
    assert listings[0].price_amount == 26500


def test_parse_brumbrum_markdown_extracts_discover_listing() -> None:
    markdown = """
![BMW Serie 3 318d MHEV 2.0 Diesel 150CV Automatico](https://files.brumbrum.it/www2/images/placeholder.gif)
BMW Serie 3
318d MHEV 2.0 Diesel 150CV - Automatico
€ 24.990
45.000 km - 2021
oppure tua a **€ 299** al mese
[Scopri di più](/auto/usata/bmw/serie-3/BR123456)
"""
    listings = parse_brumbrum_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "brumbrum"
    assert listings[0].price_amount == 24990
    assert listings[0].url.endswith("/BR123456")
