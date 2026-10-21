# protocol/ — Conventions

## Turtle Syntax

```turtle
# Prefixes at top of file
@prefix od: <urn:opendraft:ontology#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Use blank nodes for complex structures
od:Publication
    a rdfs:Class ;
    rdfs:label "Publication" ;
    rdfs:comment "A published version of an article" .
```

## SHACL Shapes

```turtle
# Node shapes for validation
od:PublicationShape
    a sh:NodeShape ;
    sh:targetClass od:Publication ;
    sh:property [
        sh:path dcterms:title ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] .
```

## Naming Conventions

- Classes: PascalCase in URI (od:Publication)
- Properties: camelCase in URI (od:hasAssignment)
- Shapes: PascalCase + Shape suffix (od:PublicationShape)
- Files: lowercase with dots (article.shacl.ttl)
- Reused vocabulary terms keep their own IRIs (SPAR/OCDM, ADR-021); do not create an `od:` alias for a term that already exists

## Validation

- All TTL must parse with `rapper` or equivalent.
- Article and registry shapes validate with any SHACL Core engine (`rdf-validate-shacl`); SHACL-SPARQL is not used.
- Article graphs assume one publication per graph (ADR-021).
- Run conformance tests before committing protocol changes.
